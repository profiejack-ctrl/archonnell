// ==============================================================================
// ARCHON NELL INCORPORATED - ENTERPRISE DATASETS FOR REALISTIC SEEDING
// Realistic Philippine Construction Chemical Domain, Names, Addresses & Products
// ==============================================================================

export interface DepartmentDef {
  code: string;
  name: string;
  description: string;
}

export interface PositionDef {
  deptCode: string;
  title: string;
  salaryGrade: string;
  baseSalary: number;
}

export interface ProductDef {
  customId: string;
  categorySlug: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  images: string[];
  specs: Record<string, any>;
}

export interface VehicleDef {
  plateNumber: string;
  model: string;
  vehicleType: string;
  capacityKg: number;
  fuelCapacityLiters: number;
  currentOdometer: number;
  status: string;
}

export const PHILIPPINE_DEPARTMENTS: DepartmentDef[] = [
  { code: 'EXEC', name: 'Executive Management', description: 'C-Level & Strategic Directors overseeing nationwide operations' },
  { code: 'HR', name: 'Human Resources & Talent', description: 'Talent Acquisition, Employee Relations, and People Operations' },
  { code: 'WFM', name: 'Workforce Operations', description: 'Shift Planning, Time & Attendance, and Field Schedule Roster' },
  { code: 'FIN', name: 'Finance & Corporate Payroll', description: 'Payroll Processing, Benefits Administration, Tax Compliance & Audit' },
  { code: 'LOG', name: 'Fleet & Supply Chain Logistics', description: 'Truck Dispatch, Metro Manila Delivery, and Warehouse Operations' },
  { code: 'PROD', name: 'Chemical Production & Plant', description: 'Polymer Blending, Concrete Admixture Formulation, Batch Testing' },
  { code: 'QA', name: 'Quality Assurance & Materials Lab', description: 'Compressive Strength, Slump, and ASTM Standards Compliance' },
  { code: 'SALES', name: 'Commercial Sales & Technical Support', description: 'General Contractor B2B Sales, Site Inspection, and Client Relations' }
];

export const PHILIPPINE_POSITIONS: PositionDef[] = [
  { deptCode: 'EXEC', title: 'President & Managing Director', salaryGrade: 'EXEC-1', baseSalary: 145000 },
  { deptCode: 'EXEC', title: 'Operations Vice President', salaryGrade: 'EXEC-2', baseSalary: 115000 },
  { deptCode: 'HR', title: 'Human Resources Director', salaryGrade: 'M1', baseSalary: 78000 },
  { deptCode: 'HR', title: 'Senior Talent Acquisition Specialist', salaryGrade: 'P3', baseSalary: 42000 },
  { deptCode: 'HR', title: 'HR & Employee Relations Associate', salaryGrade: 'P1', baseSalary: 28000 },
  { deptCode: 'WFM', title: 'Workforce Operations Lead', salaryGrade: 'M2', baseSalary: 55000 },
  { deptCode: 'WFM', title: 'Plant & Field Shift Scheduler', salaryGrade: 'P2', baseSalary: 34000 },
  { deptCode: 'FIN', title: 'Senior Payroll & Tax Officer', salaryGrade: 'P3', baseSalary: 45000 },
  { deptCode: 'FIN', title: 'Billing & Accounting Specialist', salaryGrade: 'P2', baseSalary: 35000 },
  { deptCode: 'LOG', title: 'Fleet & Logistics Supervisor', salaryGrade: 'M2', baseSalary: 48000 },
  { deptCode: 'LOG', title: 'Senior Commercial Logistics Driver', salaryGrade: 'O1', baseSalary: 29000 },
  { deptCode: 'LOG', title: 'Fleet Delivery Driver', salaryGrade: 'O1', baseSalary: 25000 },
  { deptCode: 'LOG', title: 'Warehouse Inventory Custodian', salaryGrade: 'O2', baseSalary: 24000 },
  { deptCode: 'PROD', title: 'Plant Production Superintendent', salaryGrade: 'M1', baseSalary: 68000 },
  { deptCode: 'PROD', title: 'Senior Chemical Mixing Chemist', salaryGrade: 'P3', baseSalary: 46000 },
  { deptCode: 'PROD', title: 'Batching Plant Operator', salaryGrade: 'O2', baseSalary: 27000 },
  { deptCode: 'QA', title: 'Quality Assurance Specialist', salaryGrade: 'P2', baseSalary: 38000 },
  { deptCode: 'QA', title: 'Materials Laboratory Technician', salaryGrade: 'O2', baseSalary: 26000 },
  { deptCode: 'SALES', title: 'National B2B Sales Manager', salaryGrade: 'M1', baseSalary: 75000 },
  { deptCode: 'SALES', title: 'Technical Sales Representative', salaryGrade: 'P2', baseSalary: 36000 }
];

export const PHILIPPINE_FIRST_NAMES_MALE = [
  'Juan', 'Jose', 'Mark', 'John', 'Christian', 'Carlo', 'Paolo', 'Angelo',
  'Joshua', 'Michael', 'Reynaldo', 'Rodrigo', 'Francis', 'Anthony', 'Joseph',
  'Daniel', 'Miguel', 'Rafael', 'Gabriel', 'Kenneth', 'Ferdinand', 'Eduardo',
  'Carlos', 'Ramon', 'Albert', 'Richard', 'Danilo', 'Emilio', 'Rolando'
];

export const PHILIPPINE_FIRST_NAMES_FEMALE = [
  'Maria', 'Ana', 'Christine', 'Mary', 'Kimberly', 'Joy', 'Angela', 'Patricia',
  'Camille', 'Nicole', 'Sarah', 'Katherine', 'Rochelle', 'Maricel', 'Arlene',
  'Stephanie', 'Jasmine', 'Beatrice', 'Rowena', 'Teresa', 'Grace', 'Leonora',
  'Lorna', 'Luzviminda', 'Rosario', 'Clarissa', 'Bernadette'
];

export const PHILIPPINE_LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Ramos',
  'Villanueva', 'Castillo', 'Dela Cruz', 'Fernandez', 'Aquino', 'Dizon', 'Morales',
  'Mercado', 'Navarro', 'Soriano', 'Tan', 'Lim', 'Castro', 'Flores', 'Valdez',
  'Salazar', 'Guzman', 'Pascual', 'Manalo', 'Rivera', 'Del Rosario', 'Tolentino'
];

export const PHILIPPINE_CITIES = [
  { city: 'Makati City', province: 'Metro Manila', barangay: 'Pio del Pilar', street: 'Chino Roces Ave' },
  { city: 'Makati City', province: 'Metro Manila', barangay: 'Bel-Air', street: 'Buendia Ave' },
  { city: 'Taguig City', province: 'Metro Manila', barangay: 'Fort Bonifacio', street: '32nd Street, BGC' },
  { city: 'Pasig City', province: 'Metro Manila', barangay: 'San Antonio', street: 'Ortigas Ave' },
  { city: 'Quezon City', province: 'Metro Manila', barangay: 'Diliman', street: 'Commonwealth Ave' },
  { city: 'Quezon City', province: 'Metro Manila', barangay: 'Cubao', street: 'Aurora Blvd' },
  { city: 'Muntinlupa City', province: 'Metro Manila', barangay: 'Alabang', street: 'Filinvest Corporate City' },
  { city: 'Parañaque City', province: 'Metro Manila', barangay: 'BF Homes', street: 'Aguirre Ave' },
  { city: 'Mandaluyong City', province: 'Metro Manila', barangay: 'Wack-Wack', street: 'Shaw Blvd' },
  { city: 'Silang', province: 'Cavite', barangay: 'Tartaria', street: "Governor's Drive" },
  { city: 'Carmona', province: 'Cavite', barangay: 'Maduya', street: 'Carmona Bypass Road' },
  { city: 'Dasmariñas City', province: 'Cavite', barangay: 'Salitran', street: 'Aguinaldo Highway' },
  { city: 'Santa Rosa City', province: 'Laguna', barangay: 'Don Jose', street: 'Laguna Technopark' },
  { city: 'Calamba City', province: 'Laguna', barangay: 'Real', street: 'National Highway' },
  { city: 'San Fernando City', province: 'Pampanga', barangay: 'Dolores', street: 'MacArthur Highway' }
];

export const PHILIPPINE_VEHICLES: VehicleDef[] = [
  {
    plateNumber: 'NDG-1024',
    model: 'Isuzu Elf 6-Wheeler Closed Cargo Van (4.5T)',
    vehicleType: 'Truck',
    capacityKg: 4500,
    fuelCapacityLiters: 100,
    currentOdometer: 42180,
    status: 'Available'
  },
  {
    plateNumber: 'NBR-3580',
    model: 'Mitsubishi Fuso Canter Heavy Dropside (5T)',
    vehicleType: 'Truck',
    capacityKg: 5000,
    fuelCapacityLiters: 110,
    currentOdometer: 58920,
    status: 'Available'
  },
  {
    plateNumber: 'NEB-7892',
    model: 'Toyota HiAce Commuter Cargo Delivery Van',
    vehicleType: 'Van',
    capacityKg: 1400,
    fuelCapacityLiters: 70,
    currentOdometer: 31450,
    status: 'Available'
  },
  {
    plateNumber: 'NFG-8291',
    model: 'Hino 300 Series Heavy Logistics Van (6T)',
    vehicleType: 'Truck',
    capacityKg: 6000,
    fuelCapacityLiters: 120,
    currentOdometer: 74210,
    status: 'Available'
  },
  {
    plateNumber: 'CBR-5542',
    model: 'Isuzu Giga 10-Wheeler Bulk Admixture Tanker',
    vehicleType: 'Heavy Truck',
    capacityKg: 14000,
    fuelCapacityLiters: 250,
    currentOdometer: 112500,
    status: 'Available'
  },
  {
    plateNumber: 'DAL-9012',
    model: 'Mitsubishi L300 Express Utility Van',
    vehicleType: 'Van',
    capacityKg: 1000,
    fuelCapacityLiters: 55,
    currentOdometer: 26800,
    status: 'Available'
  },
  {
    plateNumber: 'WOT-4421',
    model: 'Hyundai HD65 Insulated Chemical Transport (3.8T)',
    vehicleType: 'Truck',
    capacityKg: 3800,
    fuelCapacityLiters: 90,
    currentOdometer: 48310,
    status: 'Maintenance'
  }
];

export const SHOP_CATEGORIES = [
  { name: 'Waterproofing & Sealants', slug: 'waterproof', description: 'High-performance elastomeric, cementitious, and crystalline liquid membranes.' },
  { name: 'Concrete Admixtures & Modifiers', slug: 'admixture', description: 'High-range water reducers, slump extenders, accelerators, and air entrainers.' },
  { name: 'Epoxy & Industrial Flooring', slug: 'epoxy', description: 'Self-leveling heavy-duty epoxy, structural crack injection resins, and clear primers.' },
  { name: 'Repair Mortars & Structural Grouts', slug: 'mortar', description: 'Non-shrink structural grouts, rapid setting repair mortars, and pavement patches.' },
  { name: 'Joint Sealants & Expansion Fillers', slug: 'sealant', description: 'Polyurethane and MS hybrid expansion joint sealants for civil infrastructure.' },
  { name: 'Surface Treatments & Curing Compounds', slug: 'curing', description: 'Bio-based form release agents, curing membranes, and lithium silicate densifiers.' }
];

export const ARCHON_PRODUCTS: ProductDef[] = [
  {
    customId: 'prod-1',
    categorySlug: 'mortar',
    title: 'High-Strength Self-Leveling Mortar Repair System (25kg)',
    description: 'High-performance cementitious self-leveling mortar engineered for rapid industrial floor rehabilitation and heavy vehicular traffic.',
    price: 2450.00,
    stock: 85,
    sku: 'AN-MOR-SL25',
    images: ['https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '25kg Polyethylene-lined Moisture Proof Bag',
      compressiveStrength: '55 MPa @ 28 Days (ASTM C109)',
      flowSpread: '280 - 320 mm',
      potLife: '30 minutes @ 30°C',
      trafficReady: '24 Hours for Heavy Vehicular Traffic',
      standards: 'ASTM C109 / ASTM C348'
    }
  },
  {
    customId: 'prod-2',
    categorySlug: 'epoxy',
    title: 'Epoxy Crack Injection Resin System (Complete Kit)',
    description: 'Ultra-low viscosity structural epoxy injection polymer formulated to seal deep hairline to structural cracks in bridge decks and building columns.',
    price: 3800.00,
    stock: 45,
    sku: 'AN-EPX-INJ03',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '3L Complete Dual-Cartridge Kit with Static Mixer',
      viscosity: '180 - 250 cps (Low Viscosity Capillary Action)',
      tensileStrength: '45 MPa (ASTM D638)',
      compressiveYield: '82 MPa (ASTM D695)',
      potLife: '40 minutes @ 25°C',
      standards: 'ASTM C881 Type I, II, IV, V Grade 1 Class B & C'
    }
  },
  {
    customId: 'prod-3',
    categorySlug: 'admixture',
    title: 'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    description: 'Third-generation polycarboxylate ether (PCE) high-range water reducer producing flowing concrete with superior compressive strength and long slump retention.',
    price: 4950.00,
    stock: 60,
    sku: 'AN-ADM-SP402',
    images: ['https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '20L Sealed HDPE Carboy Container',
      dosageRate: '0.8% - 1.8% by weight of cementitious material',
      waterReduction: 'Up to 30% water reduction at constant workability',
      slumpRetention: '90 - 120 minutes @ 35°C ambient temperature',
      specificGravity: '1.08 ± 0.02',
      standards: 'ASTM C494 Type F & Type G'
    }
  },
  {
    customId: 'prod-4',
    categorySlug: 'waterproof',
    title: 'Polymer Waterproofing Membrane Coating Sealant (10L)',
    description: 'Flexible two-component polymer-modified elastomeric waterproof barrier against positive and negative hydrostatic water pressure.',
    price: 1850.00,
    stock: 120,
    sku: 'AN-WPF-EL10',
    images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '10L Liquid Component + Powder Premix Pail',
      elongationAtBreak: '> 250% (ASTM D412)',
      crackBridging: 'Up to 2.0 mm fissure bridging capacity',
      hydrostaticResistance: 'Over 5 Bar Positive Water Pressure',
      dryingTime: '4 - 6 Hours between coats @ 30°C',
      standards: 'ASTM D412 / BS EN 14891'
    }
  },
  {
    customId: 'prod-5',
    categorySlug: 'mortar',
    title: 'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    description: 'Polymer synthetic microfiber reinforcement compound delivering exceptional flexural strength under severe tollway wheel friction and heavy axle load.',
    price: 3100.00,
    stock: 70,
    sku: 'AN-MOR-MF3000',
    images: ['https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '25kg Multi-Wall Kraft Paper Bag',
      fiberAspect: 'Alkali-Resistant Synthetic Polypropylene Matrix',
      flexuralIncrease: '+ 35% Modulus of Rupture (ASTM C78)',
      shrinkageReduction: 'Up to 70% reduction in plastic shrinkage cracking',
      application: 'Tollways, Heavy Industrial Slab, Bridge Approach Slabs'
    }
  },
  {
    customId: 'prod-6',
    categorySlug: 'admixture',
    title: 'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    description: 'Chloride-free rapid setting hardening agent accelerating early compressive strength gain for critical rush road openings and precast casting.',
    price: 5200.00,
    stock: 40,
    sku: 'AN-ADM-ACC15',
    images: ['https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '15L Heavy-Duty Chemical Jerrycan',
      chlorideContent: '< 0.1% (Non-corrosive to rebar & pre-stressed steel)',
      strengthGain: 'Attains 3,000+ psi within 24 hours @ 28°C',
      settingTimeReduction: 'Initial set reduced from 6 hrs to 90 mins',
      standards: 'ASTM C494 Type C (Accelerating Admixture)'
    }
  },
  {
    customId: 'prod-7',
    categorySlug: 'epoxy',
    title: 'DuraFloor Epox 300 Heavy-Duty Self-Leveling Epoxy (15kg)',
    description: 'Solventless three-component epoxy floor screed providing exceptional chemical resistance, high gloss, and impact resistance for warehouses and labs.',
    price: 6800.00,
    stock: 35,
    sku: 'AN-EPX-DF300',
    images: ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '15kg 3-Part Pre-proportioned System (Base + Hardener + Aggregate)',
      filmThickness: '2.0 mm to 3.0 mm self-leveling topping',
      shoreDHardness: '85 Shore D (ASTM D2240)',
      abrasionResistance: '< 40 mg weight loss (CS-17 wheel, 1000 cycles)',
      finish: 'Seamless High-Gloss Dust-Proof Mirror Finish'
    }
  },
  {
    customId: 'prod-8',
    categorySlug: 'waterproof',
    title: 'HydroShield X100 Crystalline Capillary Waterproofer (25kg)',
    description: 'In-depth crystalline waterproofing slurry treatment reacting with free lime to create permanent insoluble crystal barriers inside concrete pores.',
    price: 2950.00,
    stock: 90,
    sku: 'AN-WPF-HSX100',
    images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '25kg Moisture Resistant Pail',
      penetrationDepth: 'Up to 300 mm capillary crystal growth over 6 months',
      pressureResistance: 'Resists up to 16 Bar (160m head of water)',
      selfHealing: 'Self-heals dynamic hairline cracks up to 0.4mm wide',
      standards: 'CRD-C 48-73 (Permeability of Concrete)'
    }
  },
  {
    customId: 'prod-9',
    categorySlug: 'mortar',
    title: 'StructuroGrout 60 Non-Shrink High-Strength Grout (25kg)',
    description: 'Pre-mixed, ready-to-use precision cementitious grout with controlled positive expansion, engineered for structural baseplates and machine anchors.',
    price: 1350.00,
    stock: 140,
    sku: 'AN-MOR-SG60',
    images: ['https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '25kg Heavy Duty Multi-Ply Bag',
      compressiveStrength: '65 MPa @ 28 Days (Flowable Consistency)',
      expansion: '+ 0.2% to + 1.0% early age controlled expansion',
      chlorideContent: 'Zero Chlorides / Non-Metallic / Non-Staining',
      standards: 'ASTM C1107 Grade A, B & C'
    }
  },
  {
    customId: 'prod-10',
    categorySlug: 'sealant',
    title: 'ArchonPoly 1K High-Movement Polyurethane Joint Sealant (600ml)',
    description: 'One-component moisture-curing elastomeric sealant designed for high-stress expansion joints in civil infrastructure, facades, and precast panels.',
    price: 480.00,
    stock: 350,
    sku: 'AN-SEA-PU600',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '600ml Aluminum Foil Sausage Pack',
      jointMovement: '± 25% Movement Accommodation Factor (MAF)',
      tackFreeTime: '60 - 90 minutes @ 25°C 50% RH',
      sagResistance: 'Non-sagging in vertical joints up to 30mm width',
      standards: 'ISO 11600 Class 25LM / ASTM C920 Type S'
    }
  },
  {
    customId: 'prod-11',
    categorySlug: 'curing',
    title: 'CureGuard WB Concrete Curing Compound & Sealer (20L)',
    description: 'Water-based acrylic curing compound forming an efficient micro-crystalline film that seals in 95% of batch water for optimal cement hydration.',
    price: 3400.00,
    stock: 55,
    sku: 'AN-CUR-CG20',
    images: ['https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '20L Jerrycan with Easy-Pour Spout',
      moistureLoss: '< 0.55 kg/m² after 72 hours (ASTM C156)',
      coverage: '5.0 - 7.0 m² per liter depending on surface texture',
      appearance: 'Clear semi-sheen protective film',
      standards: 'ASTM C309 Type 1 Class A & B'
    }
  },
  {
    customId: 'prod-12',
    categorySlug: 'curing',
    title: 'ArchonForm Eco Bio-Based Form Release Agent (200L Drum)',
    description: 'Biodegradable vegetable-oil emulsion providing effortless shutter stripping, smooth pinhole-free concrete surfaces, and extended plywood mold life.',
    price: 18500.00,
    stock: 18,
    sku: 'AN-CUR-AF200',
    images: ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'],
    specs: {
      packaging: '200L Steel Industrial Drum with Tamper Seals',
      chemicalAction: 'Forms calcium soaps with wet concrete, zero staining',
      coverage: '25 - 35 m² per liter on steel and smooth plywood',
      environmental: 'VOC < 10 g/L, non-hazardous, biodegradable',
      application: 'Architectural Fair-Faced Concrete & Precast Castings'
    }
  }
];

export const SHOP_VOUCHERS = [
  {
    code: 'ARCHONWELCOME',
    discountType: 'PERCENTAGE',
    discountValue: 15.00,
    minSpend: 2000.00,
    maxDiscount: 1500.00,
    usageLimit: 500,
    usedCount: 78,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true
  },
  {
    code: 'BUILDER10',
    discountType: 'PERCENTAGE',
    discountValue: 10.00,
    minSpend: 5000.00,
    maxDiscount: 3000.00,
    usageLimit: 300,
    usedCount: 114,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true
  },
  {
    code: 'MEGA500',
    discountType: 'FIXED',
    discountValue: 500.00,
    minSpend: 4000.00,
    maxDiscount: 500.00,
    usageLimit: 1000,
    usedCount: 236,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true
  },
  {
    code: 'FREESHIP',
    discountType: 'FIXED',
    discountValue: 300.00,
    minSpend: 1500.00,
    maxDiscount: 300.00,
    usageLimit: 800,
    usedCount: 312,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true
  },
  {
    code: 'PROCON2026',
    discountType: 'PERCENTAGE',
    discountValue: 20.00,
    minSpend: 25000.00,
    maxDiscount: 10000.00,
    usageLimit: 150,
    usedCount: 42,
    expiresAt: '2027-12-31T23:59:59.000Z',
    isActive: true
  }
];

export const REALISTIC_REVIEWS = [
  {
    productId: 'prod-1',
    customerName: 'Engr. Kent Tagle (EEI Corp)',
    rating: 5,
    comment: 'Super fast curing! Reopened the expressway lane in under 24 hours. The compressive strength test results clocked in at 56 MPa.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-1',
    customerName: 'Arch. Maricel Reyes',
    rating: 5,
    comment: 'Leveling mortar flowed smoothly into 15mm floor dips without air blistering. Perfectly prepared substrate for vinyl overlay.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-2',
    customerName: 'Engr. Carlos Mendoza (DMCI Project Engr)',
    rating: 5,
    comment: 'Deep penetration even on 0.2mm hairline fissure cracks. Injection ports held firm under pressure and sealed basement retaining wall.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-2',
    customerName: 'Engr. Eduardo Santos',
    rating: 5,
    comment: 'Complete dual cartridge kit with static mixing nozzles made bridge pier repair simple and clean.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-3',
    customerName: 'Engr. Antonio Aquino (Ready-Mix Batching)',
    rating: 5,
    comment: 'Maintains 200mm slump for over 90 mins in Metro Manila midday traffic. Reduced batch water by 28% without bleeding.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-3',
    customerName: 'Patricia Lim (Megawide Construction)',
    rating: 5,
    comment: 'Excellent pumpability for 45-storey continuous concrete pour in Bonifacio Global City.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-4',
    customerName: 'Engr. Joseph Tan',
    rating: 5,
    comment: 'Zero seepage in water retaining tank after 72-hour hydrostatic test. Flexible membrane bridged old cold joints cleanly.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-5',
    customerName: 'Engr. Albert Soriano',
    rating: 5,
    comment: 'Heavy axle friction showed zero raveling after 6 months of continuous container truck traffic.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-6',
    customerName: 'Engr. Richard Mercado',
    rating: 5,
    comment: 'Candaba Pampanga pilot run hit 3200 psi within 24 hours. Allowed asphalt overlay paving the very next morning.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-7',
    customerName: 'Dante Ocampo (Pharma Plant Ops)',
    rating: 5,
    comment: 'Installed 800 sqm of DuraFloor Epox 300 in cleanroom facility. High-gloss mirror finish and outstanding chemical resistance.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-9',
    customerName: 'Engr. Ferdinand Valdez',
    rating: 5,
    comment: 'Baseplate grouting for turbine generator completed with zero voids. Non-shrink expansion performed exactly to ASTM C1107 spec.',
    aiSentiment: 'Positive'
  },
  {
    productId: 'prod-10',
    customerName: 'Engr. Clarissa Guzman',
    rating: 5,
    comment: 'Exceptional adhesion on precast concrete expansion joints. Held elasticity during heavy monsoon rain temperature swings.',
    aiSentiment: 'Positive'
  }
];

export const DELIVERY_ROUTE_WAYPOINTS = [
  // Route from Archon Nell Silang Plant to Metro Manila sites (SLEX -> Skyway -> BGC/Makati/Pasig)
  { lat: 14.2312, lng: 120.9754, name: 'Archon Nell Silang Main Plant, Cavite' },
  { lat: 14.3015, lng: 121.0345, name: 'Carmona SLEX Toll Plaza' },
  { lat: 14.3621, lng: 121.0623, name: 'SLEX Southwoods / San Pedro Interlock' },
  { lat: 14.4215, lng: 121.0421, name: 'Alabang Viaduct / Skyway Ramp' },
  { lat: 14.4891, lng: 121.0289, name: 'Bicutan Skyway Section' },
  { lat: 14.5312, lng: 121.0498, name: 'BGC C-5 Staging Area, Taguig' },
  { lat: 14.5547, lng: 121.0244, name: 'Ayala Ave / Buendia Jobsite, Makati' },
  { lat: 14.5862, lng: 121.0612, name: 'Ortigas Center Commercial Staging, Pasig' }
];

export const HMO_PROVIDERS = [
  { name: 'Maxicare Healthcare Corporation', coverage: 250000.00 },
  { name: 'Intellicare (Asalus Corporation)', coverage: 200000.00 },
  { name: 'Medicard Philippines Incorporated', coverage: 180000.00 },
  { name: 'PhilCare (Philam Foundation)', coverage: 150000.00 }
];
