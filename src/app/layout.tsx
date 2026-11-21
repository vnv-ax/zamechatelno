import type { Metadata, Viewport } from "next";
import {
  Golos_Text,
  Inter,
  JetBrains_Mono,
  IBM_Plex_Sans,
  Piazzolla,
  Spectral,
  Literata,
  Pattaya,
  Great_Vibes,
  Caveat,
  Shantell_Sans,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-jbmono",
  display: "swap",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});
const piazzolla = Piazzolla({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-piazzolla",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spectral",
  display: "swap",
});
const literata = Literata({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-literata",
  display: "swap",
});
const pattaya = Pattaya({
  subsets: ["latin", "cyrillic", "thai"],
  weight: ["400"],
  variable: "--font-pattaya",
  display: "swap",
});

const vibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-vibes",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  variable: "--font-caveat",
  display: "swap",
});
const shantell = Shantell_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-shantell",
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Замечательно",
  description:
    "Учебный проект: бесконечные холсты с заметками, задачами, изображениями, колонками и вложенными листами. Данные хранятся локально.",
  keywords: ["листы", "заметки", "мозговой штурм", "замечательно"],
  icons: {
    icon: [
      { url: `${basePath}/favicon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],

    apple: [
      { url: `${basePath}/apple-touch-icon-120.png`, sizes: "120x120" },
      { url: `${basePath}/apple-touch-icon-152.png`, sizes: "152x152" },
      { url: `${basePath}/apple-touch-icon-167.png`, sizes: "167x167" },
      { url: `${basePath}/apple-touch-icon-180.png`, sizes: "180x180" },
    ],
  },
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "Замечательно",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      data-theme="academic"
      data-font="jbmono"
      style={{ backgroundColor: "#191B1E" }}
      className={`${golos.variable} ${inter.variable} ${jbmono.variable} ${plex.variable} ${piazzolla.variable} ${spectral.variable} ${literata.variable} ${pattaya.variable} ${vibes.variable} ${caveat.variable} ${shantell.variable}`}
    >
      <body className="antialiased bg-background text-foreground" style={{ backgroundColor: "#191B1E" }}>
        {

}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var isIpad=navigator.userAgent.includes('iPad')||(navigator.platform==='MacIntel'&&window.devicePixelRatio>1);var b=document.body;if(isIpad)b.classList.add('platform-ipad');if(isIpad||((window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)&&Math.min(screen.width,screen.height)>=600))b.classList.add('touch-ui');}catch(e){}`,
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
