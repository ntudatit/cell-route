mod ai;
mod auth;
mod config;
mod error;
mod fiber;
mod fiber_ops;
mod handlers;
mod indexer;
mod mcp;
mod models;
mod repository;
mod rpc;
mod state;

use ai::AiService;
use axum::{
    Router,
    http::{HeaderValue, Method},
    routing::{get, post},
};
use config::Config;
use fiber::FiberRpcService;
use fiber_ops::FiberOpsService;
use repository::{AssetEventRepository, AuthRepository, IndexerRepository, TransactionRepository};
use rpc::CkbRpcService;
use sqlx::postgres::PgPoolOptions;
use state::AppState;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    init_tracing(config.log_json);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .connect(&config.database_url)
        .await?;
    sqlx::migrate!().run(&pool).await?;

    let state = AppState {
        transactions: TransactionRepository::new(pool.clone()),
        assets: AssetEventRepository::new(pool.clone()),
        auth: AuthRepository::new(pool.clone()),
        indexer: IndexerRepository::new(pool.clone()),
        rpc: CkbRpcService::new(
            config.ckb_rpc_url.clone(),
            config.ckb_indexer_url.clone(),
            config.rpc_timeout,
        ),
        fiber: FiberRpcService::new(
            config.fiber_rpc_url.clone(),
            config.fiber_biscuit_token.clone(),
            config.rpc_timeout,
        ),
        fiber_ops: FiberOpsService::new(pool.clone()),
        ai: AiService::new(
            pool,
            config.ai_provider.clone(),
            config.ai_base_url.clone(),
            config.ai_api_key.clone(),
            config.ai_model.clone(),
            config.ai_timeout,
        ),
        config: config.clone(),
    };

    if config.fiber_runtime.eq_ignore_ascii_case("native") {
        let ops_worker_state = state.clone();
        tokio::spawn(async move {
            loop {
                if let Err(error) = ops_worker_state
                    .fiber_ops
                    .analyze_channels(
                        &ops_worker_state.fiber,
                        &ops_worker_state.config.ckb_network,
                        true,
                    )
                    .await
                {
                    tracing::warn!(error = %error, "Native FiberOps channel scan failed");
                }
                tokio::time::sleep(std::time::Duration::from_secs(
                    ops_worker_state.config.fiber_ops_scan_interval_seconds,
                ))
                .await;
            }
        });
    } else {
        info!(
            "Fiber runtime = wasm; native FNN polling worker is disabled. Browser portal owns Fiber lifecycle through fiber-js."
        );
    }

    let origin = config.cors_origin.parse::<HeaderValue>()?;
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/api/health", get(handlers::health))
        .route("/api/ai/chat", post(handlers::ai_chat))
        .route(
            "/api/ai/knowledge/search",
            get(handlers::ai_knowledge_search),
        )
        .route(
            "/api/fiber/runtime/snapshot",
            post(handlers::fiber_runtime_snapshot),
        )
        .route(
            "/api/fiber/runtime/resources",
            post(handlers::fiber_network_resources_store)
                .get(handlers::fiber_network_resources_latest),
        )
        .route("/mcp", post(mcp::endpoint))
        .route("/api/ready", get(handlers::readiness))
        .route("/api/auth/challenge", post(handlers::auth_challenge))
        .route("/api/auth/verify", post(handlers::auth_verify))
        .route("/api/auth/me", get(handlers::auth_me))
        .route("/api/ckb/network", get(handlers::network))
        .route("/api/fiber/node", get(handlers::fiber_node))
        .route(
            "/api/fiber/compatibility",
            get(handlers::fiber_compatibility),
        )
        .route(
            "/api/fiber/merchant/invoices",
            post(handlers::fiber_create_invoice),
        )
        .route(
            "/api/fiber/merchant/invoices/{payment_hash}",
            get(handlers::fiber_get_invoice),
        )
        .route("/api/fiber/payments", post(handlers::fiber_send_payment))
        .route(
            "/api/merchant/orders",
            post(handlers::merchant_order_create).get(handlers::merchant_orders_list),
        )
        .route(
            "/api/merchant/orders/{order_id}",
            post(handlers::merchant_order_update),
        )
        .route(
            "/api/merchant/orders/{order_id}/attempts",
            post(handlers::merchant_payment_attempt_create),
        )
        .route(
            "/api/fiber/payments/{payment_hash}",
            get(handlers::fiber_get_payment),
        )
        .route("/api/fiber/ops/overview", get(handlers::fiber_ops_overview))
        .route(
            "/api/fiber/ops/channels/health",
            get(handlers::fiber_channel_health),
        )
        .route(
            "/api/fiber/ops/readiness",
            post(handlers::fiber_payment_readiness),
        )
        .route("/api/fiber/ops/reconcile", post(handlers::fiber_reconcile))
        .route("/api/fiber/ops/incidents", get(handlers::fiber_incidents))
        .route("/api/fiber/ops/events", get(handlers::fiber_ops_events))
        .route("/api/ckb/tip", get(handlers::tip))
        .route(
            "/api/ckb/transactions/{tx_hash}",
            get(handlers::get_transaction),
        )
        .route("/api/transactions", post(handlers::track_transaction))
        .route(
            "/api/transactions/{tx_hash}/status",
            get(handlers::transaction_status),
        )
        .route(
            "/api/transactions/{tx_hash}/events",
            get(handlers::transaction_events),
        )
        .route("/api/assets/events", post(handlers::create_asset_event))
        .route("/api/assets/{address}", get(handlers::asset_events))
        .route("/api/indexer/sync", post(handlers::sync_indexer))
        .route(
            "/api/indexer/assets/{address}",
            get(handlers::indexed_assets),
        )
        .route("/api/dashboard/{address}", get(handlers::dashboard))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(config.bind_addr).await?;
    info!(
        address = %config.bind_addr,
        network = %config.ckb_network,
        rpc = %config.ckb_rpc_url,
        indexer = %config.ckb_indexer_url,
        service = %config.otel_service_name,
        "CKB Asset Studio API started"
    );
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing(json_logs: bool) {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "rust_service=info,tower_http=info".into());
    if json_logs {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .with_current_span(true)
            .with_span_list(true)
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }
}
