import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdData,
  JsonLdNode,
} from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * SCHEMA (handbook §24, gate SP7): a LocalBusiness-family node exists with
 * the most specific subtype, name and address (service-area: locality/region
 * + areaServed) and no self-serving Review/AggregateRating (P6-11); one
 * location is the Organization node itself, several locations each carry an
 * @id and parentOrganization → the Organization @id (P6-10, deterministic
 * part; owner confirmation of the facts stays manual).
 */
const ITEMS = ["P6-11", "P6-10"];

/** schema.org LocalBusiness and its common subtypes. */
const LOCAL_TYPES = new Set(
  `LocalBusiness AnimalShelter ArchiveOrganization AutomotiveBusiness AutoBodyShop
  AutoDealer AutoPartsStore AutoRental AutoRepair AutoWash GasStation
  MotorcycleDealer MotorcycleRepair ChildCare Dentist DryCleaningOrLaundry
  EmergencyService FireStation Hospital PoliceStation EmploymentAgency
  EntertainmentBusiness AdultEntertainment AmusementPark ArtGallery Casino
  ComedyClub MovieTheater NightClub FinancialService AccountingService
  AutomatedTeller BankOrCreditUnion InsuranceAgency FoodEstablishment Bakery
  BarOrPub Brewery CafeOrCoffeeShop Distillery FastFoodRestaurant
  IceCreamShop Restaurant Winery GovernmentOffice PostOffice
  HealthAndBeautyBusiness BeautySalon DaySpa HairSalon HealthClub NailSalon
  TattooParlor HomeAndConstructionBusiness Electrician GeneralContractor
  HVACBusiness HousePainter Locksmith MovingCompany Plumber RoofingContractor
  InternetCafe LegalService Attorney Notary Library LodgingBusiness
  BedAndBreakfast Campground Hostel Hotel Motel Resort VacationRental
  MedicalBusiness CommunityHealth Dermatology DietNutrition Emergency
  Geriatric Gynecologic MedicalClinic Midwifery Nursing Obstetric Oncologic
  Optician Optometric Otolaryngologic Pediatric Pharmacy Physician
  Physiotherapy PlasticSurgery Podiatric PrimaryCare Psychiatric PublicHealth
  ProfessionalService RadioStation RealEstateAgent RecyclingCenter
  SelfStorage ShoppingCenter SportsActivityLocation BowlingAlley
  ExerciseGym GolfCourse PublicSwimmingPool SkiResort SportsClub
  StadiumOrArena TennisComplex Store BikeStore BookStore ClothingStore
  ComputerStore ConvenienceStore DepartmentStore ElectronicsStore Florist
  FurnitureStore GardenStore GroceryStore HardwareStore HobbyShop
  HomeGoodsStore JewelryStore LiquorStore MensClothingStore MobilePhoneStore
  MovieRentalStore MusicStore OfficeEquipmentStore OutletStore PawnShop
  PetStore ShoeStore SportingGoodsStore TireShop ToyStore WholesaleStore
  TelevisionStation TouristInformationCenter TravelAgency`.split(/\s+/),
);

type Page = JsonLdData["pages"][number];
type Located = { page: Page; node: JsonLdNode };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const idOf = (value: unknown) =>
  isRecord(value) ? str(value["@id"]) : str(value);

const isLocal = (n: JsonLdNode) => n.types.some((t) => LOCAL_TYPES.has(t));

function addressKey(node: JsonLdNode): string | null {
  const a = node.properties.address;
  if (!isRecord(a)) return str(a);
  return (
    [a.streetAddress, a.addressLocality, a.postalCode]
      .map(str)
      .filter(Boolean)
      .join(", ")
      .toLowerCase() || null
  );
}

function businessProblems(node: JsonLdNode): string[] {
  const p = node.properties;
  const a = isRecord(p.address) ? p.address : {};
  const problems: string[] = [];
  if (!str(p.name)) problems.push("name missing");
  const street = str(a.streetAddress);
  const area = (str(a.addressLocality) || str(a.addressRegion)) && p.areaServed;
  if (!street && !area)
    problems.push("address missing (or locality/region + areaServed)");
  for (const k of ["aggregateRating", "review"])
    if (p[k] !== undefined) problems.push(`self-serving ${k} on the business`);
  return problems;
}

export const schemaLocalBusinessCheck: HandbookCheck = {
  id: "schema.local-business",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const ref = ({ page, node }: Located) =>
      out.evidence(
        "jsonld",
        page.url,
        JSON.stringify(node.properties, null, 1),
      );

    const all: Located[] = jsonld.pages.flatMap((page) =>
      page.nodes.map((node) => ({ page, node })),
    );
    const locals = all.filter((l) => isLocal(l.node));
    if (locals.length === 0) {
      const home = jsonld.pages[0];
      out.finding({
        itemIds: ["P6-11", "P6-10"],
        severity: "S2",
        title: "No LocalBusiness node",
        detail: `types seen: ${[...new Set(all.flatMap((l) => l.node.types))].join(", ") || "(none)"}`,
        fix: "Emit the business as its most specific LocalBusiness subtype with name, address and the Organization @id.",
        fixability: "FIXABLE",
        effort: "S",
        urls: home ? [home.url] : [ctx.origin],
        evidenceRefs: [
          out.evidence(
            "jsonld",
            home?.url ?? ctx.origin,
            home?.blocks.map((b) => b.raw).join("\n") || "no JSON-LD",
          ),
        ],
      });
      return out.build();
    }

    // P6-11
    const generic = locals.filter((l) =>
      l.node.types.every((t) => t === "LocalBusiness" || !LOCAL_TYPES.has(t)),
    );
    const broken = locals
      .map((l) => ({ l, problems: businessProblems(l.node) }))
      .filter((x) => x.problems.length > 0);
    if (broken.length > 0) {
      out.finding({
        itemIds: ["P6-11"],
        severity: "S2",
        title: "LocalBusiness node lacks name/address or rates itself",
        detail: broken
          .map(({ l, problems }) => `${l.page.url} — ${problems.join("; ")}`)
          .join("\n"),
        fix: "Give each LocalBusiness node a name and PostalAddress (service-area: locality/region + areaServed) and remove Review/AggregateRating about the business itself.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(broken.map(({ l }) => l.page.url))],
        evidenceRefs: broken.slice(0, 10).map(({ l }) => ref(l)),
      });
    }
    if (generic.length > 0) {
      out.finding({
        itemIds: ["P6-11"],
        severity: "S3",
        severityReason: "subtype choice needs owner confirmation",
        title: "LocalBusiness uses the generic type",
        detail: generic
          .map((l) => `${l.page.url} — @type LocalBusiness`)
          .join("\n"),
        fix: "Use the most specific schema.org subtype that fits (e.g. HairSalon, Dentist, Restaurant).",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(generic.map((l) => l.page.url))],
        evidenceRefs: generic.slice(0, 10).map(ref),
      });
    }
    out.pass(
      "P6-11",
      `${locals.length} LocalBusiness node(s): specific subtype, name, address, no self-rating`,
      [ref(locals[0])],
    );

    // P6-10
    const orgIds = new Set(
      all
        .filter(
          (l) =>
            !isLocal(l.node) &&
            l.node.types.some(
              (t) => t === "Organization" || t.endsWith("Organization"),
            ),
        )
        .flatMap((l) => (l.node.id ? [l.node.id] : [])),
    );
    const byAddress = new Map<string, Located>();
    for (const l of locals)
      byAddress.set(addressKey(l.node) ?? l.node.id ?? l.page.url, l);
    const locations = [...byAddress.values()];
    const problems =
      locations.length > 1
        ? locations.flatMap((l) => {
            const parent = idOf(l.node.properties.parentOrganization);
            if (!l.node.id) return [`${l.page.url} — location has no @id`];
            if (!parent)
              return [`${l.page.url} — ${l.node.id} has no parentOrganization`];
            if (orgIds.size > 0 && !orgIds.has(parent))
              return [
                `${l.page.url} — parentOrganization ${parent} is not an Organization @id`,
              ];
            return [];
          })
        : locations.flatMap((l) =>
            orgIds.size > 0 && !(l.node.id && orgIds.has(l.node.id))
              ? [
                  `${l.page.url} — single location ${l.node.id ?? "(no @id)"} is separate from Organization ${[...orgIds].join(", ")}`,
                ]
              : [],
          );
    if (problems.length > 0) {
      out.finding({
        itemIds: ["P6-10"],
        severity: "S2",
        title:
          locations.length > 1
            ? "Locations are not tied to the parent Organization"
            : "Single location is a separate node from the Organization",
        detail: problems.join("\n"),
        fix:
          locations.length > 1
            ? "Give each location its own LocalBusiness node with an @id and parentOrganization → the Organization @id."
            : "Merge the LocalBusiness and Organization into one node (one @id) for a single-location business.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(locations.map((l) => l.page.url))],
        evidenceRefs: locations.slice(0, 10).map(ref),
      });
    } else {
      out.pass(
        "P6-10",
        `${locations.length} location(s) structured correctly; facts need owner confirmation`,
        [ref(locations[0])],
      );
    }
    return out.build();
  },
};
