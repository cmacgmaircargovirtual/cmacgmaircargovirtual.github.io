/*
 * CMA CGM Air Cargo Virtual — site settings.
 * Fill these in once; every empty value hides or falls back gracefully.
 */
window.VCMA_CONFIG = {
  // Newsky "join" page of the airline, e.g. "https://newsky.app/airline/<airline id>/join".
  // Empty = the Apply buttons send pilots to the Newsky sign-up page instead.
  newskyJoinUrl: "",

  // API key created in Newsky > Airline management > General, with ONLY the "map" scope.
  // It is visible in the page source, so never use a key that has the "flights" scope here.
  newskyMapToken: "",

  // Shown in front of the flight numbers of the network table, e.g. "CMA" gives "CMA 1234".
  // Use the code the airline has on Newsky. Empty = digits only.
  flightPrefix: "",

  // Discord invite link, e.g. "https://discord.gg/xxxxxxx". Empty = Discord buttons are hidden.
  discordUrl: "",

  // Contact address shown in the footer. Empty = hidden.
  contactEmail: "",
};
