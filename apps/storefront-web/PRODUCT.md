# AgeStyles Storefront

## Purpose

Help shoppers discover products across AgeStyles stores, preview a product, choose a store and variant, add it to a cart and continue into the buyer app to pay.

## Primary visitor

A customer who knows what they want, or is browsing, and needs a clear view of products, categories, current seller options, and prices.

## Primary journeys

1. Discover products from the home catalog and category filters.
2. Search the public catalog and sort by name or price.
3. Preview a product from the list in a dialog (quick view): photos, price, store, variant, quantity and «Agregar al carrito». The full product page, indexable and shareable, holds the detail.
4. Compare that product's offers by seller, variant, and price on its page.
5. Keep a cart in the browser (a regular Medusa cart) and hand it to the buyer app (`?cart=`) for shipping, payment and account.

## Product truth and limits

- The catalog and seller offers come from the Medusa/Mercur Store API through `@agestyles/api-client`.
- The public deployment is a beta and may contain test products, sellers, and prices. The page labels that status clearly.
- Storefront code must not access PostgreSQL directly or expose Vendor/Admin credentials.
- One navigation on every page (Catálogos with the categories, Novedades, Tiendas), defined once in the root layout. Pages never draw their own header or footer.
- Product cards stay quiet: image, category, name, price and one «Agregar» action. Seller and product comparison live on the product page and `/comparar`, not on the list.
- The cart is a Medusa cart created in the browser with the publishable key; payment, shipping and account stay in the buyer app. Do not build a second checkout here.
- AgeStyles legacy remains a reference for navigation, categories, product discovery, search, and comparison; it remains a separate system.

## References to retain

- `https://agestyles.eav-labs.com`: prior AgeStyles catalog flow and category navigation.
- `references/mobile/medusa-examples/react-native-expo`: official Medusa Store API and buyer journeys.
- `references/mobile/medusa-pos-starter`: clear, task-oriented Medusa UI patterns; its Admin API credentials are never placed in a shopper client.
- `references/mobile/ecommerce-mobile-template`: product imagery, card, and filtering ideas; commerce behavior must come from the AgeStyles API.

## Design direction

Modern Luxury in a light theme: white surfaces, graphite text, restrained navy and warm neutral accents, generous spacing, editorial product imagery, and the existing AgeStyles mark. Prioritize readable product names and prices, comparison clarity, responsive layouts, keyboard access, and touch targets.
