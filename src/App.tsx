import { lazy, Suspense, useState } from 'react'
import { AppBar, Avatar, Box, Button, ButtonGroup, CircularProgress, Dialog, DialogContent, DialogTitle, Fab, IconButton, Menu, MenuItem, Toolbar, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import CompanySwitcher from './components/CompanySwitcher'
import LoginForm from './components/LoginForm'
import { ActiveCompanyProvider } from './context/ActiveCompanyContext'
import { useAuth } from './hooks/useAuth'
import { useActiveCompany } from './hooks/useActiveCompany'
import { useCompanyMembers } from './hooks/useCompanies'
import { useGameSubscriptions } from './hooks/useGameSubscriptions'
import { useIsSuperAdmin } from './hooks/useSuperAdmin'
import { supportedLanguages } from './i18n'

const Games = lazy(() => import('./pages/Games'))
const Landing = lazy(() => import('./pages/Landing'))
const Teams = lazy(() => import('./pages/Teams'))
const Players = lazy(() => import('./pages/Players'))
const Player = lazy(() => import('./pages/Player'))
const GameDetail = lazy(() => import('./pages/GameDetail'))
const NewGame = lazy(() => import('./pages/NewGame'))
const Comparinator = lazy(() => import('./pages/Comparinator'))
const Seasons = lazy(() => import('./pages/Seasons'))
const SeasonDetail = lazy(() => import('./pages/SeasonDetail'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'))
const Impressum = lazy(() => import('./pages/Impressum'))
const Datenschutz = lazy(() => import('./pages/Datenschutz'))

const navLinkStyle = { color: 'inherit', textDecoration: 'none', marginRight: 16 } as const

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
      <CircularProgress />
    </Box>
  )
}

/** Landing page for signed-out visitors, Games list for signed-in users. */
function Root() {
  const { user } = useAuth()
  return user ? <Games /> : <Landing />
}

export default function App() {
  const { loading } = useAuth()

  useGameSubscriptions()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <ActiveCompanyProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Root /></Suspense>} />
          <Route path="/games" element={<Suspense fallback={<PageLoader />}><Games /></Suspense>} />
          <Route path="/teams" element={<Suspense fallback={<PageLoader />}><Teams /></Suspense>} />
          <Route path="/players" element={<Suspense fallback={<PageLoader />}><Players /></Suspense>} />
          <Route path="/player/:id" element={<Suspense fallback={<PageLoader />}><Player /></Suspense>} />
          <Route path="/game/:id" element={<Suspense fallback={<PageLoader />}><GameDetail /></Suspense>} />
          <Route path="/new" element={<Suspense fallback={<PageLoader />}><NewGame /></Suspense>} />
          <Route path="/compare/:p1/:p2" element={<Suspense fallback={<PageLoader />}><Comparinator /></Suspense>} />
          <Route path="/seasons" element={<Suspense fallback={<PageLoader />}><Seasons /></Suspense>} />
          <Route path="/seasons/:id" element={<Suspense fallback={<PageLoader />}><SeasonDetail /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<PageLoader />}><SuperAdmin /></Suspense>} />
          <Route path="/impressum" element={<Suspense fallback={<PageLoader />}><Impressum /></Suspense>} />
          <Route path="/datenschutz" element={<Suspense fallback={<PageLoader />}><Datenschutz /></Suspense>} />
        </Routes>

        <NewGameFab />
      </AppShell>
    </ActiveCompanyProvider>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const { company } = useActiveCompany()
  const { data: members } = useCompanyMembers(company?.id ?? '')
  const myRole = members?.find((m) => m.user_id === user?.id)?.role
  const showAdminLink = isSuperAdmin || myRole === 'owner' || myRole === 'admin'
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('app.title')}
            </Link>
          </Typography>

          {user && <CompanySwitcher />}

          <NavLink to="/games" style={navLinkStyle}>
            {t('nav.games')}
          </NavLink>
          <NavLink to="/teams" style={navLinkStyle}>
            {t('nav.teams')}
          </NavLink>
          <NavLink to="/players" style={navLinkStyle}>
            {t('nav.players')}
          </NavLink>
          <NavLink to="/seasons" style={navLinkStyle}>
            {t('nav.seasons')}
          </NavLink>
          {showAdminLink && (
            <NavLink to="/admin" style={navLinkStyle}>
              {t('nav.admin')}
            </NavLink>
          )}

          <LanguageSwitcher />

          {user ? (
            <>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar src={user.user_metadata.avatar_url ?? undefined} />
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { void signOut(); setAnchorEl(null) }}>
                  {t('auth.logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button color="inherit" onClick={() => setLoginOpen(true)}>
              {t('auth.login')}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Dialog open={loginOpen && !user} onClose={() => setLoginOpen(false)}>
        <DialogTitle>{t('auth.login')}</DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <LoginForm />
        </DialogContent>
      </Dialog>

      {children}

      <Footer />
    </Box>
  )
}

function Footer() {
  const { t } = useTranslation()

  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        py: 2,
        px: 2,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7,
        fontSize: '0.875rem',
      }}
    >
      <Link to="/impressum" style={{ color: 'inherit' }}>
        {t('footer.impressum')}
      </Link>
      <Link to="/datenschutz" style={{ color: 'inherit' }}>
        {t('footer.datenschutz')}
      </Link>
      <Typography variant="caption" component="span">
        {t('footer.license')}
      </Typography>
    </Box>
  )
}

function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <ButtonGroup size="small" variant="outlined" color="inherit" sx={{ mr: 2 }}>
      {supportedLanguages.map((lang) => (
        <Button
          key={lang}
          onClick={() => void i18n.changeLanguage(lang)}
          variant={i18n.resolvedLanguage === lang ? 'contained' : 'outlined'}
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </ButtonGroup>
  )
}

const GAMES_FAB_ROUTES = ['/', '/games']

function NewGameFab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return null
  if (!GAMES_FAB_ROUTES.includes(location.pathname)) return null

  return (
    <Fab
      color="secondary"
      aria-label={t('game.new')}
      onClick={() => navigate('/new')}
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
    >
      <AddIcon />
    </Fab>
  )
}
