use testcontainers_modules::{
    postgres,
    testcontainers::{ImageExt, runners::SyncRunner},
};

#[path = "support/checkout.rs"]
mod checkout;

#[test]
fn migrations_apply_to_clean_postgres() {
    let local = std::env::var("CELLROUTE_TEST_DATABASE_URL").ok();
    let (_container, url) = match local {
        Some(url) => (None, url),
        None => {
            let container = postgres::Postgres::default()
                .with_tag("17-alpine")
                .start()
                .expect("start postgres testcontainer");
            let host = container.get_host().expect("postgres host");
            let port = container.get_host_port_ipv4(5432).expect("postgres port");
            (
                Some(container),
                format!("postgresql://postgres:postgres@{host}:{port}/postgres"),
            )
        }
    };

    let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
    runtime.block_on(async {
        let pool = sqlx::PgPool::connect(&url).await.expect("connect postgres");
        let (version,): (String,) = sqlx::query_as("SHOW server_version_num")
            .fetch_one(&pool)
            .await
            .expect("query postgres version");
        assert_eq!(version.parse::<u32>().expect("numeric postgres version") / 10000, 17);

        let fresh: bool = sqlx::query_scalar("SELECT NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')")
            .fetch_one(&pool).await.expect("check disposable database");
        assert!(fresh, "checkout integration requires a disposable empty database");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("apply migrations");

        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tracked_transactions','asset_events','wallet_auth_challenges','indexed_assets','ai_knowledge_chunks','fiber_runtime_snapshots','ai_chat_audit')",
        )
        .fetch_one(&pool)
        .await
        .expect("query tables");
        assert_eq!(count, 7);

        let (searchable,): (bool,) = sqlx::query_as(
            "SELECT search_vector @@ plainto_tsquery('english', 'liquidity') FROM ai_knowledge_chunks WHERE source='fiberops' AND title='Payment readiness'",
        )
        .fetch_one(&pool)
        .await
        .expect("query generated search vector");
        assert!(searchable, "seeded knowledge must have a generated search vector");
        checkout::verify(&pool, &url).await;
    });
}
