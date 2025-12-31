import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MeterBoard from './meter_board.jsx';
import JCBModel from './jcb_swign.jsx';
import Dashboard from './dashboard.jsx';

// NOTE: Removed wheel listener shim because it prevents OrbitControls from
// calling preventDefault on wheel events (breaking zoom). If you still see
// the Chrome passive listener warning, it's safe to ignore for dev, or we
// can patch specific listeners instead.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
