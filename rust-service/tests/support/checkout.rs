use axum::{Json, Router, extract::State, routing::post};
use ckb_sdk::{Address, AddressPayload, NetworkType};
use ckb_types::H160;
use jsonwebtoken::{EncodingKey, Header, encode};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use std::{
    net::TcpListener as StdListener,
    process::{Child, Command},
    sync::{Arc, Mutex},
    time::Duration,
};

const SECRET: &str = "checkout-integration-fixture-jwt-key-not-for-deployment";
const NODE: &str = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const GENESIS: &str = "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
const HASH: &str = "0xabababababababababababababababababababababababababababababababab";

struct ApiProcess(Child);

impl Drop for ApiProcess {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

struct Invoice {
    status: &'static str,
    amount: &'static str,
    issued: usize,
}

async fn fnn(State(state): State<Arc<Mutex<Invoice>>>, Json(req): Json<Value>) -> Json<Value> {
    let mut invoice = state.lock().unwrap();
    let result = match req["method"].as_str().unwrap() {
        "node_info" => json!({"chain_hash": GENESIS, "pubkey": NODE}),
        method @ ("new_invoice" | "get_invoice") => {
            if method == "new_invoice" {
                assert_eq!(req["params"][0]["amount"], "0x64");
                invoice.issued += 1;
            } else {
                assert_eq!(req["params"][0]["payment_hash"], HASH);
            }
            json!({
                "invoice_address": "fibt1mock-fixture",
                "status": invoice.status,
                "invoice": {"amount": invoice.amount, "currency": "Fibt",
                    "data": {"payment_hash": HASH, "attrs": [{"payee_public_key": NODE}]}}
            })
        }
        other => panic!("unexpected RPC method {other}"),
    };
    Json(json!({"jsonrpc": "2.0", "id": req["id"], "result": result}))
}

fn wallet(byte: u8) -> String {
    Address::new(
        NetworkType::Testnet,
        AddressPayload::from_pubkey_hash(H160::from([byte; 20])),
        true,
    )
    .to_string()
}

fn token(wallet: &str) -> String {
    let now = chrono::Utc::now().timestamp();
    encode(
        &Header::default(),
        &json!({"sub": wallet, "network": "testnet", "iat": now, "exp": now + 300}),
        &EncodingKey::from_secret(SECRET.as_bytes()),
    )
    .unwrap()
}

pub async fn verify(pool: &sqlx::PgPool, database: &str) {
    let mock = Arc::new(Mutex::new(Invoice {
        status: "Received",
        amount: "0x64",
        issued: 0,
    }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let fnn_url = format!("http://{}", listener.local_addr().unwrap());
    let router = Router::new().route("/", post(fnn)).with_state(mock.clone());
    let mock_server = tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });

    let api_port = StdListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let merchant = wallet(1);
    let other = wallet(2);
    let operator = wallet(3);
    let _api = ApiProcess(
        Command::new(env!("CARGO_BIN_EXE_rust-service"))
            .current_dir(std::env::temp_dir())
            .env("PORT", api_port.to_string())
            .env("DATABASE_URL", database)
            .env("APP_ENV", "production")
            .env("CKB_NETWORK", "testnet")
            .env("JWT_SECRET", SECRET)
            .env("FIBER_RUNTIME", "wasm")
            .env("FIBER_RPC_URL", fnn_url)
            .env("FIBER_BISCUIT_TOKEN", "")
            .env("FIBER_MERCHANT_WALLET", &merchant)
            .env("FIBER_MERCHANT_NODE_PUBKEY", NODE)
            .env("OPERATOR_WALLETS", &operator)
            .env("MCP_API_KEY", "")
            .env("API_TRUSTED_PROXY_IP", "")
            .spawn()
            .expect("start checkout API"),
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    let base = format!("http://127.0.0.1:{api_port}");
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            if client
                .get(format!("{base}/api/health"))
                .send()
                .await
                .is_ok_and(|r| r.status().is_success())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("API health");

    let orders = format!("{base}/api/merchant/orders");
    let merchant_token = token(&merchant);
    let other_token = token(&other);
    let response = client.get(&orders).send().await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let response = client
        .get(&orders)
        .bearer_auth(&other_token)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let snapshot = format!("{base}/api/fiber/runtime/snapshot");
    let telemetry = json!({"overview": {}, "channels": [], "incidents": []});
    let response = client
        .post(&snapshot)
        .bearer_auth(&other_token)
        .json(&telemetry)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let response = client
        .post(&snapshot)
        .bearer_auth(token(&operator))
        .json(&telemetry)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = client
        .post(format!("{base}/mcp"))
        .json(&json!({"method":"ping"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let create = |body| {
        client
            .post(&orders)
            .bearer_auth(&merchant_token)
            .header("Idempotency-Key", "test-order")
            .json(&body)
    };
    let supplied = create(json!({"amountRaw":"100","paymentHash":HASH}))
        .send()
        .await
        .unwrap();
    assert_eq!(supplied.status(), StatusCode::BAD_REQUEST);
    let order = create(json!({"amountRaw":"100"}))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    let replay = create(json!({"amountRaw":"100"}))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(order["id"], replay["id"]);
    assert_eq!(mock.lock().unwrap().issued, 1);
    assert_eq!(order["status"], "PAYMENT_PENDING");
    let reused = create(json!({"amountRaw":"101"})).send().await.unwrap();
    assert_eq!(reused.status(), StatusCode::CONFLICT);

    let id = order["id"].as_str().unwrap();
    let direct = client
        .post(format!("{orders}/{id}"))
        .bearer_auth(&merchant_token)
        .json(&json!({"status":"PAID"}))
        .send()
        .await
        .unwrap();
    assert_eq!(direct.status(), StatusCode::BAD_REQUEST);
    let db_write = sqlx::query("UPDATE merchant_orders SET status='PAID' WHERE id=$1::uuid")
        .bind(id)
        .execute(pool)
        .await;
    assert!(db_write.is_err());

    let reconcile = || {
        client
            .post(format!("{orders}/{id}/reconcile"))
            .bearer_auth(&merchant_token)
    };
    let pending = reconcile()
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(pending["status"], "PAYMENT_PENDING");
    {
        let mut invoice = mock.lock().unwrap();
        invoice.status = "Paid";
        invoice.amount = "0x65";
    }
    assert_eq!(
        reconcile().send().await.unwrap().status(),
        StatusCode::BAD_GATEWAY
    );
    mock.lock().unwrap().amount = "0x64";
    let (first, second) = tokio::join!(reconcile().send(), reconcile().send());
    for response in [first, second] {
        let paid: Value = response
            .unwrap()
            .error_for_status()
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(paid["status"], "PAID");
        assert!(paid["paidAt"].is_string());
    }
    let audits: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_logs WHERE action='FIBER_INVOICE_VERIFIED' AND subject_id=$1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(audits, 1);
    let forged = client
        .post(format!("{orders}/{id}/reconcile"))
        .bearer_auth(&other_token)
        .send()
        .await
        .unwrap();
    assert_eq!(forged.status(), StatusCode::FORBIDDEN);

    let mut limited = false;
    for n in 0..25 {
        let response = client
            .post(format!("{base}/api/auth/challenge"))
            .header("X-Forwarded-For", format!("192.0.2.{n}"))
            .header("X-Real-IP", format!("192.0.2.{n}"))
            .json(&json!({}))
            .send()
            .await
            .unwrap();
        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            assert!(response.headers().contains_key("retry-after"));
            limited = true;
            break;
        }
    }
    assert!(limited);
    mock_server.abort();
}
