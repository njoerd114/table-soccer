import { createTheme } from '@mui/material/styles'

/**
 * MUI theme — inherits the legacy app's identity:
 * team cyan #00bcd4, accent pink #ff4081, dark background.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4'
    },
    secondary: {
      main: '#ff4081'
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    }
  },
  typography: {
    fontFamily:
      'Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  shape: {
    borderRadius: 8
  }
})