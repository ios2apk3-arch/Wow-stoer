import Header from "./Header";
import Hero from "./Hero";
import Stats from "./Stats";
import About from "./About";
import Categories from "./Categories";
import WhyUs from "./WhyUs";
import Process from "./Process";
import Testimonials from "./Testimonials";
import Contact from "./Contact";
import Footer from "./Footer";
import WhatsappButton from "./WhatsappButton";

/**
 * The original Wow marketing site, kept intact at /company.
 * It renders its own chrome, so the platform Shell is skipped for this route.
 */
export default function CompanySite() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Stats />
        <About />
        <Categories />
        <WhyUs />
        <Process />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <WhatsappButton />
    </div>
  );
}
