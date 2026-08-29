use testcontainers_modules::{postgres, testcontainers::runners::SyncRunner};

#[test]
fn migrations_apply_to_clean_postgres() {
    let container = postgres::Postgres::default()
        .start()
        .expect("start postgres testcontainer");
    let host = container.get_host().expect("postgres host");
    let port = container.get_host_port_ipv4(5432).expect("postgres port");
    let url = format!("postgresql://postgres:postgres@{host}:{port}/postgres");

    let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
    runtime.block_on(async {
        let pool = sqlx::PgPool::connect(&url).await.expect("connect postgres");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("apply migrations");

        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tracked_transactions','asset_events','wallet_auth_challenges','indexed_assets')",
        )
        .fetch_one(&pool)
        .await
        .expect("query tables");
        assert_eq!(count, 4);
    });
}
