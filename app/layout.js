export const metadata = {
  title: 'CloudShield Dashboard',
  description: 'Cloud cost management operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
