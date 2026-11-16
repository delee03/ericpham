import { GoogleTagManager } from "@next/third-parties/google";
import { Inter } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "./components/footer";
import ScrollToTop from "./components/helper/scroll-to-top";
import Navbar from "./components/navbar";
import "./css/card.scss";
import "./css/globals.scss";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "Phạm Tiến Thuận Phát (Eric) - Cloud Solutions Architect & AI Engineer",
    description:
        "Portfolio of Phạm Tiến Thuận Phát (English name: Eric), a Cloud Solutions Architect and AI engineer in Ho Chi Minh City. I design cloud systems on AWS and build multi-agent AI.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.png" type="image/x-icon" />
                <title>
                    Phạm Tiến Thuận Phát (Eric) - Cloud Solutions Architect &amp; AI Engineer
                </title>
                <meta
                    name="description"
                    content="Portfolio of Phạm Tiến Thuận Phát (English name: Eric), a Cloud Solutions Architect and AI engineer in Ho Chi Minh City. I design cloud systems on AWS and build multi-agent AI."
                />
            </head>
            <body className={inter.className}>
                <ToastContainer />
                <main className="min-h-screen relative mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] text-white">
                    <Navbar />
                    {children}
                    <ScrollToTop />
                </main>
                <Footer />
            </body>
            <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM} />
        </html>
    );
}
