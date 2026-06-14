import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { FooterFaq } from "./Footer";
import { SkipToContent } from "@/components/public/SkipToContent";

interface PublicLayoutProps {
  children: React.ReactNode;
  showFaq?: boolean;
}

export function PublicLayout({
  children,
  showFaq = true,
}: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipToContent />
      <Navbar />
      <main
        className="public-page-canvas public-perspective-stage flex-1"
        id="main-content"
      >
        {children}
        {showFaq ? <FooterFaq /> : null}
      </main>
      <Footer />
    </div>
  );
}

