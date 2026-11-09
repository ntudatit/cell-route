use axum::{
    Json,
    extract::{ConnectInfo, Request, State},
    http::{StatusCode, header::RETRY_AFTER},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

const WINDOW: Duration = Duration::from_secs(60);
const MAX_PEERS: usize = 4_096;

#[derive(Clone)]
pub struct ApiLimits {
    window: Arc<Mutex<Window>>,
    trusted_proxy_ip: Option<IpAddr>,
}

struct Window {
    since: Instant,
    global_cost: u32,
    peers: HashMap<IpAddr, u32>,
}

impl ApiLimits {
    pub fn new(trusted_proxy_ip: Option<IpAddr>) -> Self {
        Self {
            window: Arc::new(Mutex::new(Window {
                since: Instant::now(),
                global_cost: 0,
                peers: HashMap::new(),
            })),
            trusted_proxy_ip: trusted_proxy_ip.map(|ip| ip.to_canonical()),
        }
    }

    fn admit(&self, ip: IpAddr, cost: u32, now: Instant) -> Result<(), u64> {
        let mut window = self
            .window
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if now.duration_since(window.since) >= WINDOW {
            window.since = now;
            window.global_cost = 0;
            window.peers.clear();
        }
        let retry_after = WINDOW
            .saturating_sub(now.duration_since(window.since))
            .as_secs()
            + 1;
        if window.global_cost + cost > 6_000
            || (!window.peers.contains_key(&ip) && window.peers.len() >= MAX_PEERS)
        {
            return Err(retry_after);
        }
        let spent = window.peers.entry(ip).or_default();
        if *spent + cost > 240 {
            return Err(retry_after);
        }
        *spent += cost;
        window.global_cost += cost;
        Ok(())
    }
}

pub async fn limit(State(limits): State<ApiLimits>, request: Request, next: Next) -> Response {
    let path = request.uri().path();
    if path == "/api/health" || request.method() == axum::http::Method::OPTIONS {
        return next.run(request).await;
    }
    let cost = if matches!(path, "/api/auth/challenge" | "/api/auth/verify")
        || path.ends_with("/events")
        || path.starts_with("/api/indexer/sync")
        || path.starts_with("/api/ai/")
        || path.starts_with("/api/dashboard/")
        || path == "/mcp"
    {
        12
    } else if path.starts_with("/api/fiber/") || path.starts_with("/api/merchant/") {
        6
    } else {
        1
    };
    let peer_ip = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|peer| peer.0.ip())
        .unwrap_or(IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED))
        .to_canonical();
    let client_ip = if limits.trusted_proxy_ip == Some(peer_ip) {
        request
            .headers()
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<IpAddr>().ok())
            .map(|ip| ip.to_canonical())
            .unwrap_or(peer_ip)
    } else {
        peer_ip
    };
    match limits.admit(client_ip, cost, Instant::now()) {
        Ok(()) => next.run(request).await,
        Err(seconds) => (
            StatusCode::TOO_MANY_REQUESTS,
            [(RETRY_AFTER, seconds.to_string())],
            Json(json!({"status": 429, "message": "Rate limit exceeded"})),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_expensive_calls_per_peer_and_resets() {
        let limits = ApiLimits::new(None);
        let now = Instant::now();
        let first = "192.0.2.1".parse().unwrap();
        let second = "192.0.2.2".parse().unwrap();
        for _ in 0..20 {
            assert!(limits.admit(first, 12, now).is_ok());
        }
        assert!(limits.admit(first, 12, now).is_err());
        assert!(limits.admit(second, 12, now).is_ok());
        assert!(limits.admit(first, 12, now + WINDOW).is_ok());
    }
}
