use testcontainers_modules::{
    postgres,
    testcontainers::{ImageExt, runners::SyncRunner},
};

#[test]
fn migrations_apply_to_clean_postgres() {
    // Match deployment; the library default is PostgreSQL 11, which cannot parse generated columns.
    let container = postgres::Postgres::default()
        .with_tag("17-alpine")
        .start()
        .expect("start postgres testcontainer");
    let host = container.get_host().expect("postgres host");
    let port = container.get_host_port_ipv4(5432).expect("postgres port");
    let url = format!("postgresql://postgres:postgres@{host}:{port}/postgres");

    let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
    runtime.block_on(async {
        let pool = sqlx::PgPool::connect(&url).await.expect("connect postgres");
        let (version,): (String,) = sqlx::query_as("SHOW server_version_num")
            .fetch_one(&pool)
            .await
            .expect("query postgres version");
        assert_eq!(version.parse::<u32>().expect("numeric postgres version") / 10000, 17);

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
    });
}
