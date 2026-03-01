import { useState, useEffect, useCallback } from "react";
import { getProductContextAll, postProductContextBulk } from "../../services/productApi";
import type {
  ProductContextAll,
  BulkSectionPayload,
  ProductBasics,
  ProductArea,
  BusinessGoal,
  CustomerSegment,
  PricingTier,
  Competitor,
  RoadmapExisting,
  RoadmapPlanned,
  Team,
  TechStackItem,
} from "../../types/product";
import {
  WizardStepBasics,
  WizardStepAreas,
  WizardStepGoals,
  WizardStepSegments,
  WizardStepCompetitors,
  WizardStepRoadmap,
  WizardStepTeams,
  WizardStepTechStack,
} from "./index";

/** 8 UI steps; steps 4 and 6 map to 2 API sections each. */
const STEP_LABELS = [
  "Product basics",
  "Product areas",
  "Business goals",
  "Segments and pricing",
  "Competitors",
  "Roadmap",
  "Teams",
  "Tech stack",
] as const;

function buildBulkPayload(ctx: ProductContextAll): BulkSectionPayload[] {
  const sections: BulkSectionPayload[] = [];

  const basics = ctx.product_basics as Record<string, unknown> | undefined;
  if (basics && Object.keys(basics).length > 0) {
    sections.push({ section: "product_basics", data: basics });
  }

  const areaItems = ctx.product_area ?? [];
  if (areaItems.length > 0) {
    sections.push({
      section: "product_area",
      items: areaItems.map((a) => ({ data: (a.data ?? {}) as Record<string, unknown> })),
    });
  }

  const goalItems = ctx.business_goal ?? [];
  if (goalItems.length > 0) {
    sections.push({
      section: "business_goal",
      items: goalItems.map((g) => ({ data: (g.data ?? {}) as Record<string, unknown> })),
    });
  }

  const segItems = ctx.customer_segment ?? [];
  if (segItems.length > 0) {
    sections.push({
      section: "customer_segment",
      items: segItems.map((s) => ({ data: (s.data ?? {}) as Record<string, unknown> })),
    });
  }

  const tierItems = ctx.pricing_tier ?? [];
  if (tierItems.length > 0) {
    sections.push({
      section: "pricing_tier",
      items: tierItems.map((t) => ({ data: (t.data ?? {}) as Record<string, unknown> })),
    });
  }

  const compItems = ctx.competitor ?? [];
  if (compItems.length > 0) {
    sections.push({
      section: "competitor",
      items: compItems.map((c) => ({ data: (c.data ?? {}) as Record<string, unknown> })),
    });
  }

  const exItems = ctx.roadmap_existing ?? [];
  if (exItems.length > 0) {
    sections.push({
      section: "roadmap_existing",
      items: exItems.map((e) => ({ data: (e.data ?? {}) as Record<string, unknown> })),
    });
  }

  const plItems = ctx.roadmap_planned ?? [];
  if (plItems.length > 0) {
    sections.push({
      section: "roadmap_planned",
      items: plItems.map((p) => ({ data: (p.data ?? {}) as Record<string, unknown> })),
    });
  }

  const teamItems = ctx.team ?? [];
  if (teamItems.length > 0) {
    sections.push({
      section: "team",
      items: teamItems.map((t) => ({ data: (t.data ?? {}) as Record<string, unknown> })),
    });
  }

  const techItems = ctx.tech_stack ?? [];
  if (techItems.length > 0) {
    sections.push({
      section: "tech_stack",
      items: techItems.map((t) => ({ data: (t.data ?? {}) as Record<string, unknown> })),
    });
  }

  return sections;
}

function parseProductBasics(d: Record<string, unknown> | undefined): Partial<ProductBasics> {
  if (!d) return {};
  return {
    product_name: (d.product_name as string) ?? "",
    description: (d.description as string) ?? undefined,
    industry: (d.industry as string) ?? undefined,
    stage: (d.stage as string) ?? undefined,
    website_url: (d.website_url as string) ?? undefined,
  };
}

function parseAreas(arr: { id: string; data: Record<string, unknown> }[] | undefined): ProductArea[] {
  if (!arr?.length) return [];
  return arr.map((a, i) => ({
    name: (a.data?.name as string) ?? "",
    description: (a.data?.description as string) ?? undefined,
    order: (a.data?.order as number) ?? i,
  }));
}

function parseGoals(arr: { id: string; data: Record<string, unknown> }[] | undefined): BusinessGoal[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    title: (a.data?.title as string) ?? "",
    description: (a.data?.description as string) ?? undefined,
    priority: (a.data?.priority as BusinessGoal["priority"]) ?? undefined,
    time_period: (a.data?.time_period as string) ?? undefined,
    linked_area: (a.data?.linked_area as string) ?? undefined,
  }));
}

function parseSegments(arr: { id: string; data: Record<string, unknown> }[] | undefined): CustomerSegment[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    description: (a.data?.description as string) ?? undefined,
    revenue_share: (a.data?.revenue_share as number) ?? undefined,
  }));
}

function parseTiers(arr: { id: string; data: Record<string, unknown> }[] | undefined): PricingTier[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    price: (a.data?.price as number) ?? undefined,
    period: (a.data?.period as PricingTier["period"]) ?? undefined,
    target_segment: (a.data?.target_segment as string) ?? undefined,
  }));
}

function parseCompetitors(arr: { id: string; data: Record<string, unknown> }[] | undefined): Competitor[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    strengths: (a.data?.strengths as string) ?? undefined,
    weaknesses: (a.data?.weaknesses as string) ?? undefined,
    differentiation: (a.data?.differentiation as string) ?? undefined,
  }));
}

function parseExisting(arr: { id: string; data: Record<string, unknown> }[] | undefined): RoadmapExisting[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    status: (a.data?.status as RoadmapExisting["status"]) ?? undefined,
    linked_area: (a.data?.linked_area as string) ?? undefined,
  }));
}

function parsePlanned(arr: { id: string; data: Record<string, unknown> }[] | undefined): RoadmapPlanned[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    status: (a.data?.status as RoadmapPlanned["status"]) ?? undefined,
    priority: (a.data?.priority as RoadmapPlanned["priority"]) ?? undefined,
    target_date: (a.data?.target_date as string) ?? undefined,
    linked_area: (a.data?.linked_area as string) ?? undefined,
  }));
}

function parseTeams(arr: { id: string; data: Record<string, unknown> }[] | undefined): Team[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    name: (a.data?.name as string) ?? "",
    lead: (a.data?.lead as string) ?? undefined,
    owns_areas: (a.data?.owns_areas as string[]) ?? [],
    size: (a.data?.size as number) ?? undefined,
    slack_channel: (a.data?.slack_channel as string) ?? undefined,
  }));
}

function parseTechStack(arr: { id: string; data: Record<string, unknown> }[] | undefined): TechStackItem[] {
  if (!arr?.length) return [];
  return arr.map((a) => ({
    category: (a.data?.category as string) ?? "",
    technology: (a.data?.technology as string) ?? "",
    notes: (a.data?.notes as string) ?? undefined,
  }));
}

interface ProductWizardProps {
  mode: "onboarding" | "settings";
  onComplete?: () => void;
}

export default function ProductWizard({ mode, onComplete }: ProductWizardProps) {
  const [ctx, setCtx] = useState<ProductContextAll | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isOnboarding = mode === "onboarding";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProductContextAll();
      setCtx(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCtx({
        product_basics: {},
        product_area: [],
        business_goal: [],
        customer_segment: [],
        pricing_tier: [],
        competitor: [],
        roadmap_existing: [],
        roadmap_planned: [],
        team: [],
        tech_stack: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "settings") {
      fetchAll();
    } else {
      setCtx({
        product_basics: {},
        product_area: [],
        business_goal: [],
        customer_segment: [],
        pricing_tier: [],
        competitor: [],
        roadmap_existing: [],
        roadmap_planned: [],
        team: [],
        tech_stack: [],
      });
      setLoading(false);
    }
  }, [mode, fetchAll]);

  const doBulkSave = useCallback(
    async (state: ProductContextAll) => {
      setSaving(true);
      setError(null);
      try {
        const sections = buildBulkPayload(state);
        if (sections.length === 0) {
          sections.push({ section: "product_basics", data: {} });
        }
        await postProductContextBulk(sections);
        setCtx(state);
        // Keep showing saved state; no refetch so a failing GET can't overwrite with empty
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [mode]
  );

  const areasForDropdown = parseAreas(ctx?.product_area);

  const handleSaveBasics = useCallback(
    async (data: ProductBasics) => {
      const next: ProductContextAll = {
        ...ctx!,
        product_basics: { ...data } as Record<string, unknown>,
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveAreas = useCallback(
    async (data: { areas: ProductArea[] }) => {
      const items = data.areas.map((a, i) => ({ data: { ...a, order: i } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        product_area: items.map((i) => ({ id: crypto.randomUUID(), data: i.data })),
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveGoals = useCallback(
    async (data: { goals: BusinessGoal[] }) => {
      const items = data.goals.map((g) => ({ data: { ...g } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        business_goal: items.map((i) => ({ id: crypto.randomUUID(), data: i.data })),
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveSegments = useCallback(
    async (data: { segments: CustomerSegment[]; pricingTiers: PricingTier[] }) => {
      const segItems = data.segments.map((s) => ({ id: crypto.randomUUID(), data: { ...s } as Record<string, unknown> }));
      const tierItems = data.pricingTiers.map((t) => ({ id: crypto.randomUUID(), data: { ...t } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        customer_segment: segItems,
        pricing_tier: tierItems,
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveCompetitors = useCallback(
    async (data: { competitors: Competitor[] }) => {
      const items = data.competitors.map((c) => ({ data: { ...c } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        competitor: items.map((i) => ({ id: crypto.randomUUID(), data: i.data })),
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveRoadmap = useCallback(
    async (data: { existing: RoadmapExisting[]; planned: RoadmapPlanned[] }) => {
      const exItems = data.existing.map((e) => ({ id: crypto.randomUUID(), data: { ...e } as Record<string, unknown> }));
      const plItems = data.planned.map((p) => ({ id: crypto.randomUUID(), data: { ...p } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        roadmap_existing: exItems,
        roadmap_planned: plItems,
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveTeams = useCallback(
    async (data: { teams: Team[] }) => {
      const items = data.teams.map((t) => ({ data: { ...t } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        team: items.map((i) => ({ id: crypto.randomUUID(), data: i.data })),
      };
      await doBulkSave(next);
      if (isOnboarding && activeStep < 7) setActiveStep(activeStep + 1);
    },
    [ctx, doBulkSave, isOnboarding, activeStep]
  );

  const handleSaveTechStack = useCallback(
    async (data: { techStack: TechStackItem[] }) => {
      const items = data.techStack.map((t) => ({ data: { ...t } as Record<string, unknown> }));
      const next: ProductContextAll = {
        ...ctx!,
        tech_stack: items.map((i) => ({ id: crypto.randomUUID(), data: i.data })),
      };
      await doBulkSave(next);
      if (isOnboarding) {
        if (activeStep < 7) setActiveStep(activeStep + 1);
        else onComplete?.();
      }
    },
    [ctx, doBulkSave, isOnboarding, activeStep, onComplete]
  );

  const handleFinish = useCallback(async () => {
    const current = ctx ?? {
      product_basics: {},
      product_area: [],
      business_goal: [],
      customer_segment: [],
      pricing_tier: [],
      competitor: [],
      roadmap_existing: [],
      roadmap_planned: [],
      team: [],
      tech_stack: [],
    };
    const sections = buildBulkPayload(current);
    if (sections.length === 0) {
      sections.push({ section: "product_basics", data: {} });
    }
    setSaving(true);
    try {
      await postProductContextBulk(sections);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [ctx, onComplete]);

  const handleSkip = useCallback(async () => {
    if (activeStep < 7) setActiveStep(activeStep + 1);
    else {
      const current = ctx ?? {
        product_basics: {},
        product_area: [],
        business_goal: [],
        customer_segment: [],
        pricing_tier: [],
        competitor: [],
        roadmap_existing: [],
        roadmap_planned: [],
        team: [],
        tech_stack: [],
      };
      const sections = buildBulkPayload(current);
      if (sections.length === 0) sections.push({ section: "product_basics", data: {} });
      setSaving(true);
      try {
        await postProductContextBulk(sections);
        onComplete?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    }
  }, [activeStep, ctx, onComplete]);

  const handleBack = useCallback(() => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  }, [activeStep]);

  if (loading && mode === "settings") {
    return <p className="text-gray-400 py-8">Loading wizard data...</p>;
  }

  const currentCtx = ctx ?? {
    product_basics: {},
    product_area: [],
    business_goal: [],
    customer_segment: [],
    pricing_tier: [],
    competitor: [],
    roadmap_existing: [],
    roadmap_planned: [],
    team: [],
    tech_stack: [],
  };

  if (mode === "settings") {
    return (
      <div className="flex gap-6">
        <div className="w-48 flex flex-col gap-1 shrink-0">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`px-4 py-2 rounded-lg text-left text-sm ${
                activeStep === i
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}
          <h3 className="text-gray-100 font-medium mb-2">{STEP_LABELS[activeStep]}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {activeStep === 0 && "Basic information about your product."}
            {activeStep === 1 && "Product areas help auto-detect feedback topics."}
            {activeStep === 2 && "Business goals and priorities."}
            {activeStep === 3 && "Customer segments and pricing tiers."}
            {activeStep === 4 && "Competitor analysis."}
            {activeStep === 5 && "Existing and planned features."}
            {activeStep === 6 && "Teams and ownership."}
            {activeStep === 7 && "Technology stack."}
          </p>
          {activeStep === 0 && (
            <WizardStepBasics
              initialData={parseProductBasics(currentCtx.product_basics as Record<string, unknown>)}
              onSave={handleSaveBasics}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 1 && (
            <WizardStepAreas
              initialData={{ product_area: currentCtx.product_area }}
              onSave={handleSaveAreas}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 2 && (
            <WizardStepGoals
              initialData={{ business_goal: currentCtx.business_goal }}
              areas={areasForDropdown}
              onSave={handleSaveGoals}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 3 && (
            <WizardStepSegments
              segments={parseSegments(currentCtx.customer_segment)}
              pricingTiers={parseTiers(currentCtx.pricing_tier)}
              onSave={handleSaveSegments}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 4 && (
            <WizardStepCompetitors
              competitors={parseCompetitors(currentCtx.competitor)}
              onSave={handleSaveCompetitors}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 5 && (
            <WizardStepRoadmap
              existing={parseExisting(currentCtx.roadmap_existing)}
              planned={parsePlanned(currentCtx.roadmap_planned)}
              areas={areasForDropdown}
              onSave={handleSaveRoadmap}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 6 && (
            <WizardStepTeams
              teams={parseTeams(currentCtx.team)}
              areas={areasForDropdown}
              onSave={handleSaveTeams}
              saving={saving}
              submitLabel="Save"
            />
          )}
          {activeStep === 7 && (
            <WizardStepTechStack
              techStack={parseTechStack(currentCtx.tech_stack)}
              onSave={handleSaveTechStack}
              saving={saving}
              submitLabel="Save"
            />
          )}
        </div>
      </div>
    );
  }

  const submitLabel = activeStep === 7 ? "Save and Finish" : "Save and Next";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-400 mb-1">
          Step {activeStep + 1} of 8
        </p>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} className={i <= activeStep ? "text-blue-500" : "text-gray-600"}>
              {i <= activeStep ? "●" : "○"}
            </span>
          ))}
        </div>
      </div>

      <h3 className="text-gray-100 font-medium text-lg">{STEP_LABELS[activeStep]}</h3>
      <p className="text-sm text-gray-500 mb-4">
        {activeStep === 0 && "Basic information about your product."}
        {activeStep === 1 && "Product areas help auto-detect feedback topics."}
        {activeStep === 2 && "Business goals and priorities."}
        {activeStep === 3 && "Customer segments and pricing tiers."}
        {activeStep === 4 && "Competitor analysis."}
        {activeStep === 5 && "Existing and planned features."}
        {activeStep === 6 && "Teams and ownership."}
        {activeStep === 7 && "Technology stack."}
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {activeStep === 0 && (
        <WizardStepBasics
          initialData={parseProductBasics(currentCtx.product_basics as Record<string, unknown>)}
          onSave={handleSaveBasics}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 1 && (
        <WizardStepAreas
          initialData={{ product_area: currentCtx.product_area }}
          onSave={handleSaveAreas}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 2 && (
        <WizardStepGoals
          initialData={{ business_goal: currentCtx.business_goal }}
          areas={areasForDropdown}
          onSave={handleSaveGoals}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 3 && (
        <WizardStepSegments
          segments={parseSegments(currentCtx.customer_segment)}
          pricingTiers={parseTiers(currentCtx.pricing_tier)}
          onSave={handleSaveSegments}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 4 && (
        <WizardStepCompetitors
          competitors={parseCompetitors(currentCtx.competitor)}
          onSave={handleSaveCompetitors}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 5 && (
        <WizardStepRoadmap
          existing={parseExisting(currentCtx.roadmap_existing)}
          planned={parsePlanned(currentCtx.roadmap_planned)}
          areas={areasForDropdown}
          onSave={handleSaveRoadmap}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 6 && (
        <WizardStepTeams
          teams={parseTeams(currentCtx.team)}
          areas={areasForDropdown}
          onSave={handleSaveTeams}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}
      {activeStep === 7 && (
        <WizardStepTechStack
          techStack={parseTechStack(currentCtx.tech_stack)}
          onSave={handleSaveTechStack}
          saving={saving}
          submitLabel={submitLabel}
        />
      )}

      <div className="flex justify-between pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={handleBack}
          disabled={activeStep === 0}
          className="px-4 py-2 text-gray-400 hover:text-gray-100 disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2 text-gray-400 hover:text-gray-100"
          >
            Skip
          </button>
          {activeStep === 7 && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
