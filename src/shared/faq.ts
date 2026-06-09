import { m } from './paraglide/messages.js'

export interface FaqSection {
  section: string
  items: { q: string; a: string }[]
}

/** Build the FAQ in the active locale. A function (not a const) so each call
 *  re-resolves the Paraglide messages -- callers render it inside the
 *  LocaleProvider, which re-runs this on a language switch. */
export function getFaq(): FaqSection[] {
  return [
    {
      section: m.faq_sec_general(),
      items: [
        { q: m.faq_tos_q(), a: m.faq_tos_a() },
        { q: m.faq_poe2_q(), a: m.faq_poe2_a() },
      ],
    },
    {
      section: m.faq_sec_tips(),
      items: [
        { q: m.faq_macros_q(), a: m.faq_macros_a() },
        { q: m.faq_macro_regex_q(), a: m.faq_macro_regex_a() },
        { q: m.faq_sync_q(), a: m.faq_sync_a() },
        { q: m.faq_sound_packs_q(), a: m.faq_sound_packs_a() },
      ],
    },
    {
      section: m.faq_sec_broke(),
      items: [
        { q: m.faq_detect_q(), a: m.faq_detect_a() },
        { q: m.faq_overlay_q(), a: m.faq_overlay_a() },
        { q: m.faq_filter_updates_q(), a: m.faq_filter_updates_a() },
        { q: m.faq_changes_lost_q(), a: m.faq_changes_lost_a() },
        { q: m.faq_hideout_q(), a: m.faq_hideout_a() },
        { q: m.faq_bad_currency_q(), a: m.faq_bad_currency_a() },
        { q: m.faq_update_q(), a: m.faq_update_a() },
      ],
    },
  ]
}
