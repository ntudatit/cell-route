import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WalletRouteGuard } from "./components/WalletRouteGuard";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";
import { WalletPage } from "./pages/app/WalletPage";
import { TransactionsPage } from "./pages/app/TransactionsPage";
import { CellsPage } from "./pages/app/CellsPage";
import { ExplorerPage } from "./pages/app/ExplorerPage";
import { FaucetPage } from "./pages/app/FaucetPage";
import { DocsPage } from "./pages/app/DocsPage";
import { TransferCkbPage } from "./pages/features/TransferCkbPage";
import { StoreDataPage } from "./pages/features/StoreDataPage";
import { FungibleTokenPage } from "./pages/features/FungibleTokenPage";
import { DobSporePage } from "./pages/features/DobSporePage";
import { SignMessagePage } from "./pages/features/SignMessagePage";
import { PlaygroundGuide } from "./pages/guides/PlaygroundGuide";
import { ConnectWalletsGuide } from "./pages/guides/ConnectWalletsGuide";
import { ComposeTransactionsGuide } from "./pages/guides/ComposeTransactionsGuide";
import { SignMessagesGuide } from "./pages/guides/SignMessagesGuide";
import { UdtTokensGuide } from "./pages/guides/UdtTokensGuide";
import { SporeProtocolGuide } from "./pages/guides/SporeProtocolGuide";
import { NodeBackendGuide } from "./pages/guides/NodeBackendGuide";
import { AssetPortfolioPage } from "./pages/app/AssetPortfolioPage";
import { SporeClusterPage } from "./pages/features/SporeClusterPage";
import { ProjectLoading } from "./components/ProjectLoading";
import { FiberRuntimeProvider } from "./fiber-wasm/FiberRuntimeContext";
import { PlatformOverviewPage } from "./pages/PlatformOverviewPage";

const BrowserFiberNodePage = lazy(() => import("./pages/fiberops/BrowserFiberNodePage").then(m => ({ default: m.BrowserFiberNodePage })));
const FiberOpsOverviewPage = lazy(() => import("./pages/fiberops/FiberOpsOverviewPage").then(m => ({ default: m.FiberOpsOverviewPage })));
const FiberAiCopilotPage = lazy(() => import("./pages/ai/FiberAiCopilotPage").then(m => ({ default: m.FiberAiCopilotPage })));
const FiberMerchantPage = lazy(() => import("./pages/features/FiberMerchantPage").then(m => ({ default: m.FiberMerchantPage })));
const FiberTransferConsolePage = lazy(() => import("./pages/fiberops/FiberTransferConsolePage").then(m => ({ default: m.FiberTransferConsolePage })));
const FiberTwoNodeLabPage = lazy(() => import("./pages/fiberops/FiberTwoNodeLabPage").then(m => ({ default: m.FiberTwoNodeLabPage })));
const ExternalFundingPage = lazy(() => import("./pages/fiberops/ExternalFundingPage").then(m => ({ default: m.ExternalFundingPage })));
const FiberCheckoutPage = lazy(() => import("./pages/checkout/FiberCheckoutPage").then(m => ({ default: m.FiberCheckoutPage })));

function Protected({ children }: { children: ReactNode }) {
  return <WalletRouteGuard>{children}</WalletRouteGuard>;
}

function FiberFeature({ children }: { children: ReactNode }) {
  return <FiberRuntimeProvider>{children}</FiberRuntimeProvider>;
}

export default function App() {
  return (
    <><ProjectLoading /><Suspense fallback={<div className="route-loading" role="status">Loading FiberOps...</div>}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/platform" element={<PlatformOverviewPage />} />
      <Route path="/checkout" element={<FiberFeature><FiberCheckoutPage /></FiberFeature>} />
      <Route path="/merchant" element={<FiberFeature><FiberMerchantPage /></FiberFeature>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
      <Route path="/cells" element={<Protected><CellsPage /></Protected>} />
      <Route path="/transfer-ckb" element={<Protected><TransferCkbPage /></Protected>} />
      <Route path="/store-data" element={<Protected><StoreDataPage /></Protected>} />
      <Route path="/fungible-token" element={<Protected><FungibleTokenPage /></Protected>} />
      <Route path="/dob-spore" element={<Protected><DobSporePage /></Protected>} />
      <Route path="/spore-clusters" element={<Protected><SporeClusterPage /></Protected>} />
      <Route path="/sign-message" element={<Protected><SignMessagePage /></Protected>} />
      <Route path="/activity-log" element={<Protected><TransactionsPage /></Protected>} />
      <Route path="/assets" element={<Protected><AssetPortfolioPage /></Protected>} />
      <Route path="/transactions" element={<Navigate to="/activity-log" replace />} />
      <Route path="/explorer" element={<Protected><ExplorerPage /></Protected>} />
      <Route path="/faucet" element={<Protected><FaucetPage /></Protected>} />
      <Route path="/docs" element={<Protected><DocsPage /></Protected>} />
      <Route path="/playground" element={<Protected><PlaygroundGuide /></Protected>} />
      <Route path="/connect-wallets" element={<Protected><ConnectWalletsGuide /></Protected>} />
      <Route path="/compose-transactions" element={<Protected><ComposeTransactionsGuide /></Protected>} />
      <Route path="/sign-messages" element={<Protected><SignMessagesGuide /></Protected>} />
      <Route path="/udt-tokens" element={<Protected><UdtTokensGuide /></Protected>} />
      <Route path="/spore-protocol" element={<Protected><SporeProtocolGuide /></Protected>} />
      <Route path="/node-backend" element={<Protected><NodeBackendGuide /></Protected>} />
      <Route path="/fiber-funding" element={<Protected><ExternalFundingPage /></Protected>} />
      <Route path="/fiber-node" element={<FiberFeature><BrowserFiberNodePage /></FiberFeature>} />
      <Route path="/fiber-ai" element={<FiberFeature><FiberAiCopilotPage /></FiberFeature>} />
      <Route path="/fiber-merchant" element={<FiberFeature><FiberMerchantPage /></FiberFeature>} />
      <Route path="/fiber-transfers" element={<FiberFeature><FiberTransferConsolePage /></FiberFeature>} />
      <Route path="/fiber-lab" element={<FiberFeature><FiberTwoNodeLabPage /></FiberFeature>} />
      <Route path="/fiber-ops" element={<FiberFeature><FiberOpsOverviewPage /></FiberFeature>} />
      <Route path="/fiber-ops/readiness" element={<Navigate to="/fiber-ops#readiness" replace />} />
      <Route path="/fiber-ops/channels" element={<Navigate to="/fiber-ops#channels" replace />} />
      <Route path="/fiber-ops/reconciliation" element={<Navigate to="/fiber-ops#reconciliation" replace />} />
      <Route path="/fiber-ops/incidents" element={<Navigate to="/fiber-ops#incidents" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense></>
  );
}
