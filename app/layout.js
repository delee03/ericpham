import { GoogleTagManager } from "@next/third-parties/google";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./css/globals.scss";

const display = Space_Grotesk({
    subsets: ["latin", "vietnamese"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-display",
});
const sans = Inter({
    subsets: ["latin", "vietnamese"],
    variable: "--font-sans",
});
const mono = JetBrains_Mono({
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500"],
    variable: "--font-mono",
});

export const metadata = {
    title: "Phạm Tiến Thuận Phát (Eric) - Cloud Solutions Architect & AI Engineer",
    description:
        "Portfolio of Phạm Tiến Thuận Phát (English name: Eric), a Cloud Solutions Architect and AI engineer in Ho Chi Minh City. I design cloud systems on AWS and build multi-agent AI.",
};

export const viewport = {
    themeColor: "#05060A",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
            <body className="bg-void font-sans text-ink antialiased">{children}</body>
            <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM} />
        </html>
    );
}
