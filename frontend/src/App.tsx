import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from '@/components/Layout'
import { Empty } from '@/components/States'
import { ToastProvider } from '@/components/Toast'
import { AuthProvider } from '@/lib/auth'
import { CartProvider } from '@/lib/cartContext'
import { ChatProvider } from '@/lib/chat'
import Account from '@/pages/Account'
import Admin from '@/pages/Admin'
import AuthPage from '@/pages/Auth'
import Browse from '@/pages/Browse'
import Cart from '@/pages/Cart'
import Home from '@/pages/Home'
import { HelpPage, PaymentsPage, PrivacyPage, TermsPage } from '@/pages/Legal'
import Inbox from '@/pages/Inbox'
import { OrderDetail } from '@/pages/Orders'
import ProductPage from '@/pages/ProductPage'
import Seller from '@/pages/Seller'
import StorePage from '@/pages/StorePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ChatProvider>
            <ToastProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="browse" element={<Browse />} />
                <Route path="stores/:id" element={<StorePage />} />
                <Route path="products/:id" element={<ProductPage />} />
                <Route path="cart" element={<Cart />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="login" element={<AuthPage />} />
                <Route path="register" element={<AuthPage />} />
                <Route path="orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
                <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
                <Route path="inbox" element={<RequireAuth><Inbox /></RequireAuth>} />
                <Route path="seller" element={<Seller />} />
                <Route path="admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
                <Route path="*" element={<Empty title="Page not found" />} />
              </Route>
            </Routes>
            </ToastProvider>
          </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
