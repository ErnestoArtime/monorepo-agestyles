# AgeStyles Storefront

## Purpose

Help shoppers discover products across AgeStyles stores, compare each product's seller offers, and continue into the existing buyer app for the purchase flow.

## Primary visitor

A customer who knows what they want, or is browsing, and needs a clear view of products, categories, current seller options, and prices.

## Primary journeys

1. Discover products from the home catalog and category filters.
2. Search the public catalog and sort by name or price.
3. Open a product page that can be indexed and shared.
4. Compare that product's offers by seller, variant, and price.
5. Continue to the buyer app for cart, account, and checkout.

## Product truth and limits

- The catalog and seller offers come from the Medusa/Mercur Store API through `@agestyles/api-client`.
- The public deployment is a beta and may contain test products, sellers, and prices. The page labels that status clearly.
- Storefront code must not access PostgreSQL directly or expose Vendor/Admin credentials.
- Do not imply a store directory or purchase behavior until the public API supports it. Seller comparisons belong on product pages, where the product offer endpoint supplies the seller and variant data.
- AgeStyles legacy remains a reference for navigation, categories, product discovery, search, and comparison; it remains a separate system.

## References to retain

- `https://agestyles.eav-labs.com`: prior AgeStyles catalog flow and category navigation.
- `references/mobile/medusa-examples/react-native-expo`: official Medusa Store API and buyer journeys.
- `references/mobile/medusa-pos-starter`: clear, task-oriented Medusa UI patterns; its Admin API credentials are never placed in a shopper client.
- `references/mobile/ecommerce-mobile-template`: product imagery, card, and filtering ideas; commerce behavior must come from the AgeStyles API.

## Design direction

Modern Luxury in a light theme: white surfaces, graphite text, restrained navy and warm neutral accents, generous spacing, editorial product imagery, and the existing AgeStyles mark. Prioritize readable product names and prices, comparison clarity, responsive layouts, keyboard access, and touch targets.
