import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Note: StrictMode removed due to Supabase auth lock conflicts
// StrictMode double-mounts components, causing auth session conflicts
createRoot(document.getElementById('root')!).render(<App />)
