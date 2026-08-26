import { Suspense, lazy, type ReactElement } from "react";
import { I18nProvider } from "./i18n";
import { RouterProvider, matchPath, useRouter } from "./app/router";
import { Shell } from "./app/Shell";
import { ToastProvider } from "./ui";

import Home from "./pages/Home";
import SearchPage from "./pages/Search";
import ProductPage from "./pages/Product";
import SuppliersPage from "./pages/Suppliers";
import SupplierPage from "./pages/Supplier";
import CartPage from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrdersPage from "./pages/Orders";
import OrderPage from "./pages/Order";
import RfqListPage from "./pages/Rfq";
import RfqNewPage from "./pages/RfqNew";
import RfqDetailPage from "./pages/RfqDetail";
import NegotiationsPage from "./pages/Negotiations";
import MessagesPage from "./pages/Messages";
import NotificationsPage from "./pages/Notifications";
import AiPage from "./pages/Ai";
import IntelligencePage from "./pages/Intelligence";
import ForecastingPage from "./pages/Forecasting";
import BuyerDashboard from "./pages/dashboard/Buyer";
import SupplierDashboard from "./pages/dashboard/SupplierDash";
import AdminDashboard from "./pages/dashboard/Admin";
import { LoginPage, RegisterPage } from "./pages/Auth";
import ProfilePage from "./pages/Profile";
import NotFound from "./pages/NotFound";

/**
 * The marketing site is the only route pulling in framer-motion and the
 * inline unDraw artwork, so it is split out of the main bundle.
 */
const CompanySite = lazy(() => import("./pages/company/Site"));

/**
 * Route table. Static paths are matched first, then the `:id` patterns —
 * so `/rfq/new` wins over `/rfq/:id`.
 *
 * `/company` renders outside the platform Shell because the marketing site
 * ships its own header and footer.
 */
const staticRoutes: Record<string, () => ReactElement> = {
  "/": () => <Home />,
  "/search": () => <SearchPage />,
  "/suppliers": () => <SuppliersPage />,
  "/cart": () => <CartPage />,
  "/checkout": () => <Checkout />,
  "/orders": () => <OrdersPage />,
  "/rfq": () => <RfqListPage />,
  "/rfq/new": () => <RfqNewPage />,
  "/negotiations": () => <NegotiationsPage />,
  "/messages": () => <MessagesPage />,
  "/notifications": () => <NotificationsPage />,
  "/ai": () => <AiPage />,
  "/intelligence": () => <IntelligencePage />,
  "/forecasting": () => <ForecastingPage />,
  "/dashboard": () => <BuyerDashboard />,
  "/supplier": () => <SupplierDashboard />,
  "/admin": () => <AdminDashboard />,
  "/login": () => <LoginPage />,
  "/register": () => <RegisterPage />,
  "/profile": () => <ProfilePage />,
};

const dynamicRoutes: { pattern: string; render: (params: Record<string, string>) => ReactElement }[] = [
  { pattern: "/product/:id", render: (p) => <ProductPage id={p.id} /> },
  { pattern: "/supplier/:id", render: (p) => <SupplierPage id={p.id} /> },
  { pattern: "/order/:id", render: (p) => <OrderPage id={p.id} /> },
  { pattern: "/rfq/:id", render: (p) => <RfqDetailPage id={p.id} /> },
];

function Routes() {
  const { path } = useRouter();

  if (path === "/company") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <CompanySite />
      </Suspense>
    );
  }

  const staticRoute = staticRoutes[path];
  if (staticRoute) return <Shell>{staticRoute()}</Shell>;

  for (const route of dynamicRoutes) {
    const params = matchPath(route.pattern, path);
    if (params) return <Shell>{route.render(params)}</Shell>;
  }

  return (
    <Shell>
      <NotFound />
    </Shell>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <RouterProvider>
          <Routes />
        </RouterProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
