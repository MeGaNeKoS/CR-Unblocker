# DMCA notice: Crunchyroll, LLC (18 November 2026)

On 18 November 2026, Mozilla disabled CR-Unblocker on Firefox Add-ons (AMO) after receiving a DMCA notice from Remove Your Media LLC, acting for Crunchyroll, LLC. The full text of Mozilla's email and the notice is below.

## What the notice claims

- **The claim is under 17 U.S.C. § 1201, not copyright infringement.** The notice does not say the add-on contains or copies any Crunchyroll work. It says the add-on is a technology for getting around a measure that controls access to copyrighted works, and that offering it to the public is "trafficking" under § 1201(a)(2) and (b)(1).
- **The access control it names is Crunchyroll's region check.** Crunchyroll licenses titles territory by territory and uses region checks tied to the viewer's location and session to decide which titles a viewer can open.
- **It says the add-on exists to defeat those checks.** It points to the add-on routing Crunchyroll's region-checked requests through a US proxy so that crunchyroll.com treats the user as being in the United States, while CDN files load directly.
- **It quotes the AMO listing**, which promised the "full US Crunchyroll anime library" from any region, including Japan.
- **It cites the project's history**: the listing's mention of "session ID manipulation" and an old homepage changelog entry asking volunteers to run "unblock servers".
- **It objects to the name.** It says "CR-Unblocker" and the slug "crunchy-unblocker" trade on the Crunchyroll name.
- **It asks Mozilla to stop distributing every version**, including updates to existing installs.

## How the project has changed

- Versions 2.x (2017 to 2020) worked by swapping Crunchyroll session IDs.
- Versions 3.x (from 2022) dropped that and sent the login request through a proxy, plus the first page load from 3.2.0.
- Versions 4.x (from July 2025) are a per-site proxy. The add-on tells Firefox which proxy to use for Crunchyroll requests and does not read or change cookies, headers, logins, or sessions.

Mozilla confirmed that the complaint covers what the current version does, and that rewriting the listing would not resolve it.

## Outcome

We are not contesting the notice. CR-Unblocker will not be published on AMO again, and existing installs no longer receive updates.

## Full text

Mozilla's email to the add-on owners, with the notice attached below the line:


> Dear contributor,
>
> We received the attached notification under Mozilla’s Digital Millennium Copyright Act (“DMCA”) policy (https://www.mozilla.org/about/legal/report-infringement/) complaining of allegedly infringing activity by you on our service at https://addons.mozilla.org/en-US/firefox/addon/crunchy-unblocker/. We have removed or disabled access to your addon identified by the claimant as infringing the claimant's copyright.
>
> If you believe your content was removed or disabled as a result of a mistake or misidentification of the material to be removed or disabled (e.g., you have permission to post it or you believe it is a fair use), you may submit a counter notification to us at dmcanotice@mozilla.com. We refer you to our DMCA policy page for the requirements for a valid counter notification and more information.
>
> We remind you of our repeat infringer termination policy. Under our policy, we may terminate, at our discretion, a user’s account if under appropriate circumstances they are determined to be a repeat infringer.
>
> Sincerely,
> Mozilla Legal Team
>
> ---
>
> To Mozilla's Designated DMCA Agent:
>
> Remove Your Media LLC is the authorized agent for Crunchyroll, LLC. We are writing about a Firefox add-on listed on addons.mozilla.org that is built to get around the access controls Crunchyroll uses on crunchyroll.com. We ask that Mozilla remove the listing and disable distribution of the add-on.
>
> 1. The add-on
>
> Name: CR-Unblocker
>
> Listing: https://addons.mozilla.org/en-US/firefox/addon/crunchy-unblocker/
>
> Developer profile: https://addons.mozilla.org/en-US/firefox/user/18758560/ (めがねこ)
>
> Current version: 4.1.1, last updated October 6, 2026
>
> Homepage: https://cr-unblocker.us.to/
>
> Proxy server named in the listing: us.community-proxy.meganeko.dev
>
> 2. The works and the access control
>
> Crunchyroll streams copyrighted anime series and films on crunchyroll.com under licenses that are granted territory by territory. Which titles a viewer can open depends on the viewer's region. Crunchyroll enforces this with region checks tied to the viewer's location and session. Those checks are how Crunchyroll controls access to each work in the places where it holds the rights, and they keep the works from being opened in regions where it does not.
>
> 3. How the add-on circumvents it
>
> The add-on exists for one purpose: to defeat those region checks. The listing says plainly what it does. It promises access to the "full US Crunchyroll anime library" from any region, including Japan. It does this by taking control of the browser's proxy settings and routing only Crunchyroll's geo-restricted requests through a US proxy, us.community-proxy.meganeko.dev, so that crunchyroll.com treats the user as if they were in the United States. Static and CDN files load directly. Only the requests that carry the region check are sent through the proxy.
>
> The add-on asks for access to crunchyroll.com data and control of browser proxy settings. Those permissions serve no purpose other than this bypass. The listing also says it "removes the need for session ID manipulation," which refers to the earlier method the project used to defeat the same checks. The developer's homepage describes the tool as switching Crunchyroll regions through a pool of "unblock servers" and asks volunteers to run more of them.
>
> The add-on is a technology primarily designed to circumvent a measure that controls access to copyrighted works. It has no commercially significant purpose other than that, and it is marketed for that use. Offering it to the public is trafficking under 17 U.S.C. § 1201(a)(2). Because the region checks also protect Crunchyroll's exclusive rights to distribute and publicly perform the works in licensed territories, the add-on also falls under § 1201(b)(1).
>
> The listing has been installed by more than 1,700 users and has been maintained and updated for this purpose. The slug "crunchy-unblocker" and the name "CR-Unblocker" both trade on the Crunchyroll name. Crunchyroll has not authorized this add-on.
>
> 4. Request
>
> Please remove https://addons.mozilla.org/en-US/firefox/addon/crunchy-unblocker/ and stop distribution of all versions of the add-on, including any updates pushed to existing installs.
>
> 5. Statements
>
> I have a good faith belief that the add-on and the activity described above are not authorized by the copyright owner, its agent, or the law.
>
> The information in this notice is accurate. Under penalty of perjury, I am authorized to act on behalf of Crunchyroll, LLC, the owner of the exclusive rights at issue.
>
> Crunchyroll reserves all civil rights and remedies, including those under 17 U.S.C. § 1203.
>
> Contact:
>
> Remove Your Media LLC
>
> 3308 Preston Rd Ste 350-157
>
> Plano, TX 75093 USA
>
> infringement@removeyourmedia.com
>
> []
>
> Authorized agent for owner
