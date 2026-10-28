import { Outlet, Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { AppLayout } from './pages/app/AppLayout'
import { Drive } from './pages/app/Drive'
import { Home } from './pages/app/Home'
import { ProfileTab } from './pages/app/ProfileTab'
import { Trips } from './pages/app/Trips'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { RegisterConsent } from './pages/RegisterConsent'
import { RegisterProfile } from './pages/RegisterProfile'

function MarketingLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

// Marketing pages use Header/Footer; the sign-in flow and the app have their own chrome.
export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route
        path="/register/consent"
        element={
          <RequireAuth stage="consent">
            <RegisterConsent />
          </RequireAuth>
        }
      />
      <Route
        path="/register/profile"
        element={
          <RequireAuth stage="profile">
            <RegisterProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth stage="app">
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="drive" element={<Drive />} />
        <Route path="trips" element={<Trips />} />
        <Route path="profile" element={<ProfileTab />} />
      </Route>
      <Route element={<MarketingLayout />}>
        <Route path="*" element={<Landing />} />
      </Route>
    </Routes>
  )
}
