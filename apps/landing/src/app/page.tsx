import Navbar      from '@/components/sections/Navbar'
import Hero        from '@/components/sections/Hero'
import Problems    from '@/components/sections/Problems'
import Solution    from '@/components/sections/Solution'
import Features    from '@/components/sections/Features'
import Pricing     from '@/components/sections/Pricing'
import Comparison  from '@/components/sections/Comparison'
import Testimonials from '@/components/sections/Testimonials'
import FAQ         from '@/components/sections/FAQ'
import CTA         from '@/components/sections/CTA'
import Footer      from '@/components/sections/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] overflow-x-hidden">
      <Navbar />
      <Hero />
      <Problems />
      <Solution />
      <Features />
      <Pricing />
      <Comparison />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  )
}
