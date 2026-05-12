import SplashOverlay from '@/components/SplashOverlay'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SplashOverlay />
      {children}
    </>
  )
}
