import Header from "./components/Header";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import About from "./components/About";
import Categories from "./components/Categories";
import WhyUs from "./components/WhyUs";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import WhatsappButton from "./components/WhatsappButton";

export default function App() {
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
