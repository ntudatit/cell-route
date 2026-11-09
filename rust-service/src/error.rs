use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    Conflict(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("upstream error: {0}")]
    Upstream(String),
    #[error("{0}")]
    Unavailable(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, message.as_str()),
            Self::NotFound(message) => (StatusCode::NOT_FOUND, message.as_str()),
            Self::Unauthorized(message) => (StatusCode::UNAUTHORIZED, message.as_str()),
            Self::Forbidden(message) => (StatusCode::FORBIDDEN, message.as_str()),
            Self::Conflict(message) => (StatusCode::CONFLICT, message.as_str()),
            Self::Unavailable(message) => (StatusCode::SERVICE_UNAVAILABLE, message.as_str()),
            Self::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database request failed"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal request failed"),
            Self::Upstream(_) => (StatusCode::BAD_GATEWAY, "Upstream request failed"),
        };

        (
            status,
            Json(json!({
                "status": status.as_u16(),
                "error": status.canonical_reason().unwrap_or("Error"),
                "message": message
            })),
        )
            .into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn keeps_upstream_diagnostics_out_of_public_response() {
        let response = ApiError::Upstream("sensitive RPC diagnostics".into()).into_response();
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = to_bytes(response.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["message"], "Upstream request failed");
    }
}
