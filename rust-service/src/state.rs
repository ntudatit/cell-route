use crate::{
    ai::AiService,
    config::Config,
    fiber::FiberRpcService,
    fiber_ops::FiberOpsService,
    repository::{AssetEventRepository, AuthRepository, IndexerRepository, TransactionRepository},
    rpc::CkbRpcService,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub transactions: TransactionRepository,
    pub assets: AssetEventRepository,
    pub auth: AuthRepository,
    pub indexer: IndexerRepository,
    pub rpc: CkbRpcService,
    pub fiber: FiberRpcService,
    pub fiber_ops: FiberOpsService,
    pub ai: AiService,
}
