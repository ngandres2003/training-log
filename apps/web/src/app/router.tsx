import { createBrowserRouter } from 'react-router'

function Home() {
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] bg-background px-4 py-6 text-foreground">
      <h1 className="text-2xl font-semibold">Training Log</h1>
    </main>
  )
}

export const router = createBrowserRouter([{ path: '*', element: <Home /> }])
