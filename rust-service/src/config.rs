use std::{env, net::SocketAddr, time::Duration};

#[derive(Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub trusted_proxy_ip: Option<std::net::IpAddr>,
    pub database_url: String,
    pub cors_origin: String,
    pub ckb_network: String,
    pub ckb_rpc_url: String,
    pub ckb_indexer_url: String,
    pub jwt_secret: String,
    pub jwt_ttl_seconds: i64,
    pub auth_challenge_ttl_seconds: i64,
    pub xudt_code_hash: Option<String>,
    pub sudt_code_hash: Option<String>,
    pub spore_code_hash: Option<String>,
    pub spore_cluster_code_hash: Option<String>,
    pub rpc_timeout: Duration,
    pub sse_poll_interval_ms: u64,
    pub sse_max_polls: usize,
    pub log_json: bool,
    pub otel_service_name: String,
    pub otel_exporter_otlp_endpoint: Option<String>,
    pub fiber_runtime: String,
    pub fiber_rpc_url: String,
    pub fiber_biscuit_token: Option<String>,
    pub fiber_merchant_wallet: Option<String>,
    pub fiber_merchant_node_pubkey: Option<String>,
    pub operator_wallets: Vec<String>,
    pub fiber_ops_scan_interval_seconds: u64,
    pub fiber_expected_version: String,
    pub ai_provider: String,
    pub ai_base_url: Option<String>,
    pub ai_api_key: Option<String>,
    pub ai_model: Option<String>,
    pub ai_timeout: Duration,
    pub mcp_api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".into())
            .parse::<u16>()?;

        let rpc_timeout_seconds = env::var("RPC_TIMEOUT_SECONDS")
            .unwrap_or_else(|_| "12".into())
            .parse::<u64>()?;

        let ckb_network = env::var("CKB_NETWORK")
            .unwrap_or_else(|_| "testnet".into())
            .trim()
            .to_lowercase();
        let default_rpc = default_ckb_rpc(&ckb_network)?;
        let ckb_rpc_url = optional_env("CKB_RPC_URL").unwrap_or_else(|| default_rpc.into());
        let ckb_indexer_url =
            optional_env("CKB_INDEXER_URL").unwrap_or_else(|| ckb_rpc_url.clone());

        let environment = env::var("APP_ENV").unwrap_or_else(|_| "development".into());
        let jwt_secret = optional_env("JWT_SECRET").unwrap_or_else(|| "dev-only-change-me".into());
        validate_jwt_secret(&environment, &ckb_network, &jwt_secret)?;

        let fiber_merchant_wallet = optional_env("FIBER_MERCHANT_WALLET");
        let fiber_merchant_node_pubkey = optional_env("FIBER_MERCHANT_NODE_PUBKEY");
        anyhow::ensure!(
            fiber_merchant_wallet.is_some() == fiber_merchant_node_pubkey.is_some(),
            "Configure both FIBER_MERCHANT_WALLET and FIBER_MERCHANT_NODE_PUBKEY"
        );
        if let Some(pubkey) = &fiber_merchant_node_pubkey {
            anyhow::ensure!(
                matches!(ckb_network.as_str(), "testnet" | "mainnet"),
                "The merchant receiver requires CKB Testnet or Mainnet"
            );
            anyhow::ensure!(
                pubkey.len() == 66
                    && pubkey == &pubkey.to_ascii_lowercase()
                    && pubkey.parse::<secp256k1::PublicKey>().is_ok(),
                "Invalid compressed merchant node public key"
            );
        }
        let operator_wallets: Vec<String> = optional_env("OPERATOR_WALLETS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
            .collect();
        for wallet in operator_wallets.iter().chain(fiber_merchant_wallet.iter()) {
            crate::auth::validate_wallet_network(wallet, &ckb_network)?;
        }
        if environment == "production" {
            if let Some(key) = optional_env("MCP_API_KEY") {
                validate_jwt_secret(&environment, &ckb_network, &key)?;
                anyhow::ensure!(key != jwt_secret, "MCP_API_KEY must differ from JWT_SECRET");
            }
        }

        Ok(Self {
            bind_addr: SocketAddr::new(
                optional_env("API_BIND_IP")
                    .unwrap_or_else(|| "0.0.0.0".into())
                    .parse()?,
                port,
            ),
            trusted_proxy_ip: optional_env("API_TRUSTED_PROXY_IP")
                .map(|ip| ip.parse())
                .transpose()?,
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                format!("postgresql://postgres:postgres@localhost:5432/cellroute_{ckb_network}")
            }),
            cors_origin: env::var("CORS_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".into()),
            ckb_network,
            ckb_rpc_url,
            ckb_indexer_url,
            jwt_secret,
            jwt_ttl_seconds: env::var("JWT_TTL_SECONDS")
                .unwrap_or_else(|_| "3600".into())
                .parse::<i64>()?,
            auth_challenge_ttl_seconds: env::var("AUTH_CHALLENGE_TTL_SECONDS")
                .unwrap_or_else(|_| "300".into())
                .parse::<i64>()?,
            xudt_code_hash: optional_env("XUDT_CODE_HASH"),
            sudt_code_hash: optional_env("SUDT_CODE_HASH"),
            spore_code_hash: optional_env("SPORE_CODE_HASH"),
            spore_cluster_code_hash: optional_env("SPORE_CLUSTER_CODE_HASH"),
            rpc_timeout: Duration::from_secs(rpc_timeout_seconds),
            sse_poll_interval_ms: env::var("SSE_POLL_INTERVAL_MS")
                .unwrap_or_else(|_| "2000".into())
                .parse::<u64>()?,
            sse_max_polls: env::var("SSE_MAX_POLLS")
                .unwrap_or_else(|_| "300".into())
                .parse::<usize>()?,
            log_json: env::var("LOG_JSON")
                .unwrap_or_else(|_| "false".into())
                .eq_ignore_ascii_case("true"),
            otel_service_name: env::var("OTEL_SERVICE_NAME")
                .unwrap_or_else(|_| "ckb-asset-studio-rust-service".into()),
            otel_exporter_otlp_endpoint: optional_env("OTEL_EXPORTER_OTLP_ENDPOINT"),
            fiber_runtime: env::var("FIBER_RUNTIME").unwrap_or_else(|_| "wasm".into()),
            fiber_rpc_url: env::var("FIBER_RPC_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8227".into()),
            fiber_biscuit_token: optional_env("FIBER_BISCUIT_TOKEN"),
            fiber_merchant_wallet,
            fiber_merchant_node_pubkey,
            operator_wallets,
            fiber_ops_scan_interval_seconds: env::var("FIBER_OPS_SCAN_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "15".into())
                .parse::<u64>()?,
            fiber_expected_version: env::var("FIBER_EXPECTED_VERSION")
                .unwrap_or_else(|_| "0.9.0".into()),
            ai_provider: env::var("AI_PROVIDER").unwrap_or_else(|_| "disabled".into()),
            ai_base_url: optional_env("AI_BASE_URL"),
            ai_api_key: optional_env("AI_API_KEY"),
            ai_model: optional_env("AI_MODEL"),
            ai_timeout: Duration::from_secs(
                env::var("AI_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "45".into())
                    .parse::<u64>()?,
            ),
            mcp_api_key: optional_env("MCP_API_KEY"),
        })
    }
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
}

fn default_ckb_rpc(network: &str) -> anyhow::Result<&'static str> {
    match network {
        "mainnet" => Ok("https://mainnet.ckb.dev"),
        "testnet" => Ok("https://testnet.ckb.dev"),
        "devnet" => Ok("http://127.0.0.1:8114"),
        _ => anyhow::bail!("Unsupported CKB_NETWORK: {network}"),
    }
}

#[cfg(test)]
mod network_tests {
    use super::default_ckb_rpc;
    #[test]
    fn selects_rpc_for_each_chain() {
        assert_eq!(
            default_ckb_rpc("mainnet").unwrap(),
            "https://mainnet.ckb.dev"
        );
        assert_eq!(
            default_ckb_rpc("testnet").unwrap(),
            "https://testnet.ckb.dev"
        );
        assert_eq!(default_ckb_rpc("devnet").unwrap(), "http://127.0.0.1:8114");
        assert!(default_ckb_rpc("mainent").is_err());
    }
}

fn validate_jwt_secret(environment: &str, network: &str, secret: &str) -> anyhow::Result<()> {
    let production = match environment {
        "production" => true,
        "development" => false,
        _ => anyhow::bail!("APP_ENV must be development or production"),
    };
    let normalized = secret.to_ascii_lowercase();
    if (production || network == "mainnet")
        && (secret.len() < 32
            || normalized.contains("replace")
            || normalized.contains("change-me")
            || normalized.contains("change_me")
            || normalized.contains("your-secret"))
    {
        anyhow::bail!(
            "Production and Mainnet require a randomly generated JWT_SECRET of at least 32 bytes; development defaults and placeholders are not allowed"
        );
    }
    Ok(())
}

#[cfg(test)]
mod jwt_secret_tests {
    use super::validate_jwt_secret;
    #[test]
    fn rejects_development_and_placeholder_secrets() {
        for secret in [
            "",
            "dev-only-change-me",
            "short",
            "REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_BYTES",
        ] {
            assert!(validate_jwt_secret("development", "mainnet", secret).is_err());
            assert!(validate_jwt_secret("production", "testnet", secret).is_err());
        }
    }
    #[test]
    fn allows_configured_secret_and_development_defaults() {
        // Synthetic validation fixture, never used for signing.
        assert!(validate_jwt_secret("development", "mainnet", &"a".repeat(32)).is_ok());
        assert!(validate_jwt_secret("production", "testnet", &"a".repeat(32)).is_ok());
        assert!(validate_jwt_secret("prod", "testnet", &"a".repeat(32)).is_err());
        assert!(validate_jwt_secret("development", "testnet", "dev-only-change-me").is_ok());
        assert!(validate_jwt_secret("development", "devnet", "dev-only-change-me").is_ok());
    }
}
