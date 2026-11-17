import { createBrowserRouter } from 'react-router'

function Home() {
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] bg-hierro px-4 py-6 text-arena">
      <h1 className="font-display text-3xl uppercase">Training Log</h1>
    </main>
  )
}

export const router = createBrowserRouter([{ path: '*', element: <Home /> }])
