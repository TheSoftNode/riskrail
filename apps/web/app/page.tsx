import { Attestation } from "@/components/landing/attestation";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Developers } from "@/components/landing/developers";
import { Fragmentation } from "@/components/landing/fragmentation";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Protocols } from "@/components/landing/protocols";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { StressShowcase } from "@/components/landing/stress-showcase";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Fragmentation />
        <HowItWorks />
        <StressShowcase />
        <Attestation />
        <Protocols />
        <Developers />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
