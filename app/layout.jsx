import "./globals.css";
export const metadata = { title: "SecureMark", description: "Invisible, encrypted image watermarks for ownership verification and tamper detection." };
export default function RootLayout({ children }) {
    return <html lang="en"><body>{children}</body></html>;
}
