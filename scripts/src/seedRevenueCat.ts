import { getUncachableRevenueCatClient } from "./revenueCatClient.js";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
  type Duration,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Suraksha";

const APP_STORE_APP_NAME = "Suraksha iOS";
const APP_STORE_BUNDLE_ID = "com.sakhisuraksha.app";
const PLAY_STORE_APP_NAME = "Suraksha Android";
const PLAY_STORE_PACKAGE_NAME = "com.sakhisuraksha.app";

// Entitlement
const ENTITLEMENT_LOOKUP_KEY = "pro";
const ENTITLEMENT_DISPLAY_NAME = "Suraksha Pro";

// Offering
const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

// Products: [store_identifier (iOS/Test), play_store_identifier, display_name, duration, rc_package_key, prices_usd_micros]
const PRODUCTS = [
  {
    iosId: "suraksha_premium_monthly",
    androidId: "suraksha_premium_monthly:monthly",
    displayName: "Suraksha Premium",
    title: "Suraksha Premium",
    duration: "P1M",
    packageKey: "$rc_monthly",
    packageDisplayName: "Monthly",
    priceUsdMicros: 4990000,   // $4.99
    priceInrMicros: 449000000, // ₹449
  },
  {
    iosId: "yearly",
    androidId: "yearly:yearly",
    displayName: "Yearly",
    title: "Yearly",
    duration: "P1Y",
    packageKey: "$rc_annual",
    packageDisplayName: "Yearly",
    priceUsdMicros: 39990000,  // $39.99
    priceInrMicros: 3499000000,// ₹3499
  },
  {
    iosId: "lifetime",
    androidId: "lifetime",
    displayName: "Lifetime",
    title: "Lifetime",
    duration: null, // one-time
    packageKey: "$rc_lifetime",
    packageDisplayName: "Lifetime",
    priceUsdMicros: 99990000,  // $99.99
    priceInrMicros: 8999000000,// ₹8999
  },
] as const;

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } =
    await listProjects({ client, query: { limit: 20 } });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // ── Apps ─────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let iosApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let androidApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found");
  console.log("Test Store app:", testApp.id);

  if (!iosApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    iosApp = data;
    console.log("Created App Store app:", iosApp.id);
  } else {
    console.log("App Store app:", iosApp.id);
  }

  if (!androidApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    androidApp = data;
    console.log("Created Play Store app:", androidApp.id);
  } else {
    console.log("Play Store app:", androidApp.id);
  }

  // ── Products ─────────────────────────────────────────────────
  const { data: allProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeIdentifier: string,
    displayName: string,
    title: string,
    duration: Duration | null,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = allProducts.items?.find(
      (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id,
    );
    if (existing) {
      console.log(`  ${label} product already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: storeIdentifier,
      app_id: targetApp.id,
      type: duration ? "subscription" : "non_consumable",
      display_name: displayName,
    };

    if (isTestStore) {
      if (duration) body.subscription = { duration: { duration } };
      body.title = title;
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`  Created ${label} product:`, created.id);
    return created;
  };

  const addTestStorePrices = async (productId: string, usdMicros: number, _inrMicros: number) => {
    const { error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: productId },
      body: {
        // Test store only reliably supports USD; production prices are set in App Store Connect / Play Console
        prices: [{ amount_micros: usdMicros, currency: "USD" }],
      },
    });
    if (error) {
      if (typeof error === "object" && "type" in error && error["type"] === "resource_already_exists") {
        console.log("  Test store prices already set");
      } else {
        console.warn("  Warning: failed to set prices:", JSON.stringify(error));
      }
    } else {
      console.log("  Test store prices set (USD + INR)");
    }
  };

  // Store all created products for entitlement attachment
  const allProductIds: string[] = [];
  const packageProductMap: Record<string, { testId: string; iosId: string; androidId: string }> = {};

  for (const def of PRODUCTS) {
    console.log(`\nProcessing product: ${def.displayName} (${def.iosId})`);
    const testProd = await ensureProduct(testApp, "Test Store", def.iosId, def.displayName, def.title, def.duration, true);
    const iosProd = await ensureProduct(iosApp, "App Store", def.iosId, def.displayName, def.title, def.duration, false);
    const androidProd = await ensureProduct(androidApp, "Play Store", def.androidId, def.displayName, def.title, def.duration, false);

    await addTestStorePrices(testProd.id, def.priceUsdMicros, def.priceInrMicros);

    allProductIds.push(testProd.id, iosProd.id, androidProd.id);
    packageProductMap[def.packageKey] = { testId: testProd.id, iosId: iosProd.id, androidId: androidProd.id };
  }

  // ── Entitlement ───────────────────────────────────────────────
  const { data: entitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  let entitlement: Entitlement | undefined;
  const existingEntitlement = entitlements.items?.find(
    (e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY || e.display_name === ENTITLEMENT_DISPLAY_NAME,
  );
  if (existingEntitlement) {
    console.log("\nEntitlement already exists:", existingEntitlement.id, `(${existingEntitlement.lookup_key})`);
    entitlement = existingEntitlement;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_LOOKUP_KEY, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) {
      if (error.type === "resource_already_exists") {
        // Already exists but may use a different lookup_key — re-list to find it
        const { data: refreshed } = await listEntitlements({
          client,
          path: { project_id: project.id },
          query: { limit: 50 },
        });
        entitlement = refreshed?.items?.find(
          (e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY || e.display_name === ENTITLEMENT_DISPLAY_NAME,
        );
        if (!entitlement) throw new Error("Entitlement resource_already_exists but not findable in list");
        console.log("\nEntitlement found (was already created):", entitlement.id, `(${entitlement.lookup_key})`);
      } else {
        throw new Error(`Failed to create entitlement: ${JSON.stringify(error)}`);
      }
    } else {
      console.log("\nCreated entitlement:", newEnt.id, `(${newEnt.lookup_key})`);
      entitlement = newEnt;
    }
  }
  if (!entitlement) throw new Error("Entitlement could not be resolved");

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntErr && attachEntErr.type !== "unprocessable_entity_error") {
    throw new Error("Failed to attach products to entitlement");
  }
  console.log("Products attached to entitlement");

  // ── Offering ──────────────────────────────────────────────────
  const { data: offerings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  let offering: Offering;
  const existingOffering = offerings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("\nOffering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOff, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("\nCreated offering:", newOff.id);
    offering = newOff;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  // ── Packages ──────────────────────────────────────────────────
  const { data: existingPkgs, error: listPkgsError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPkgsError) throw new Error("Failed to list packages");

  for (const def of PRODUCTS) {
    const pkgKey = def.packageKey;
    const pkgName = def.packageDisplayName;
    const prods = packageProductMap[pkgKey];
    if (!prods) continue;

    let pkg: Package;
    const existingPkg = existingPkgs.items?.find((p) => p.lookup_key === pkgKey);
    if (existingPkg) {
      console.log(`\nPackage ${pkgKey} already exists:`, existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: pkgKey, display_name: pkgName },
      });
      if (error) throw new Error(`Failed to create package ${pkgKey}: ${JSON.stringify(error)}`);
      console.log(`\nCreated package ${pkgKey}:`, newPkg.id);
      pkg = newPkg;
    }

    const { error: attachErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: prods.testId, eligibility_criteria: "all" },
          { product_id: prods.iosId, eligibility_criteria: "all" },
          { product_id: prods.androidId, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachErr) {
      if (attachErr.message?.includes("Cannot attach product")) {
        console.log(`  Package ${pkgKey}: products already attached`);
      } else {
        console.warn(`  Warning attaching to ${pkgKey}:`, JSON.stringify(attachErr));
      }
    } else {
      console.log(`  Attached products to ${pkgKey}`);
    }
  }

  // ── API Keys ──────────────────────────────────────────────────
  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testApp.id } });
  const { data: iosKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: iosApp.id } });
  const { data: androidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: androidApp.id } });

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Entitlement lookup_key:", ENTITLEMENT_LOOKUP_KEY, "(display:", ENTITLEMENT_DISPLAY_NAME + ")");
  console.log("\nPublic API Keys:");
  console.log("  Test Store:", testKeys?.items[0]?.key ?? "N/A");
  console.log("  App Store: ", iosKeys?.items[0]?.key ?? "N/A");
  console.log("  Play Store:", androidKeys?.items[0]?.key ?? "N/A");
  console.log("\nSet these environment variables:");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY =", testKeys?.items[0]?.key ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY =", iosKeys?.items[0]?.key ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY =", androidKeys?.items[0]?.key ?? "N/A");
  console.log("REVENUECAT_PROJECT_ID =", project.id);
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
