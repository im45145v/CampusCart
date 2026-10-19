import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-sm text-taupe">18 October 2026</p>
      <div className="space-y-4 text-sm leading-relaxed">{children}</div>
    </article>
  )
}

export function TermsPage() {
  return (
    <Page title="Terms">
      <p>UniCart is a board where students on one campus sell food, take print jobs, or lend gear. The stall you order from is run by that student. UniCart is the software they use. It is not the kitchen, the print shop, or the owner of a borrowed projector.</p>
      <h2 className="text-base font-bold">Accounts</h2>
      <p>Use your own name. One person, one account. You are responsible for orders placed while you are logged in.</p>
      <h2 className="text-base font-bold">Orders</h2>
      <p>The total at checkout is the price. Pickup or a campus meetup follows the stall’s rules, including a time slot when the stall asks for one. You can cancel while the order is still placed or accepted, and while a quote is open. A seller can reject an order, or cancel it before it is completed. Stock held for a cancelled or rejected order goes back on sale. A completed order is finished: the credits, if any, then belong to the seller.</p>
      <h2 className="text-base font-bold">Printing</h2>
      <p>You upload the file and choose paper, ink, copies, and binding. The price follows that stall’s rate card. Only upload work you have the right to print. The seller receives the file so they can print it.</p>
      <h2 className="text-base font-bold">Borrowing</h2>
      <p>A borrow fee is the seller’s rate for each day or each hour, up to the longest borrow on that listing. It is not a purchase, and UniCart does not hold a deposit. Return the item by the date you gave, in the condition you agreed. If the stall is pay upfront, that fee is campus credits. A cancel or rejection returns them. Once the owner marks the item back, the order is completed and the fee stays with them.</p>
      <h2 className="text-base font-bold">Payment</h2>
      <p>Each stall chooses how it is paid. Campus wallet credits are an on-campus ledger. To add credits you choose an amount and pay in the YouPI checkout from your own UPI app. The credits stay unspendable until UniCart verifies YouPI’s signed confirmation. Closing the payment page does not add them. A payout leaves your spendable balance when you request it, until staff mark it paid or return it. UniCart does not read your bank itself.</p>
      <p>A stall marked pay upfront accepts only campus credits. The credits leave your balance when the price is known: when you place a priced order, or when you accept a quote. That stall does not take cash when you collect. Pay on pickup means you pay the seller in person, and UniCart does not hold that cash. Pay the seller directly means they confirm they received it. UniCart does not check either of those against a bank.</p>
      <p>A cancelled or rejected order returns campus credits once. A completed order does not. Plans and promo codes use the same ledger. A code lowers what you pay, and the stall receives that amount. Plans do not renew by themselves. Cancelling a plan stops the next period, and the credits already paid for the current period stay with the stall.</p>
      <h2 className="text-base font-bold">Listings</h2>
      <p>A seller reviews a listing before it is published. A draft from the writing assistant is not a listing until the seller saves it. The assistant fills only the price, stock, and time the seller stated. A seller may feature up to three listings on the home page. That place is free. UniCart does not sell it and does not promise that a featured listing will sell.</p>
      <h2 className="text-base font-bold">Conduct</h2>
      <p>Do not list illegal goods, harass anyone in messages, or upload files you have no right to share. Use Report on a stall, listing, or message. Campus desk staff can hide a listing or suspend a stall.</p>
      <p>Using UniCart after this date means you accept these terms. The current version is this page.</p>
    </Page>
  )
}

export function PrivacyPage() {
  return (
    <Page title="Privacy">
      <p>UniCart stores what the stalls and orders need. It is not sold, and it is not used for ads.</p>
      <h2 className="text-base font-bold">What is stored</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name and email. A sign-in code is kept only as a hash until it expires. Password accounts also store a bcrypt hash.</li>
        <li>Orders, pickup slots, checkout answers, reviews, and messages.</li>
        <li>Stall details, listings, photos, and print files you upload.</li>
        <li>The campus wallet ledger: top-up checkouts, the YouPI payment id, payouts, refunds, and the note you wrote.</li>
      </ul>
      <h2 className="text-base font-bold">Who can see it</h2>
      <p>The other person on an order or a chat can see that thread. A seller sees orders for their stall. Campus desk staff can see reports, stall applications, and wallet entries they need to mark paid. Print files are for that order.</p>
      <h2 className="text-base font-bold">Closing an account</h2>
      <p>Ask the campus desk to close your account. Orders already placed stay on the record so the stall can finish them.</p>
    </Page>
  )
}

export function PaymentsPage() {
  return (
    <Page title="Payments">
      <p>A stall is paid in campus credits, or in cash the seller confirms in person. The stall page says which.</p>
      <h2 className="text-base font-bold">Campus wallet</h2>
      <p>Credits pay for orders and stall plans. Add between ₹10 and ₹2,000 at a time, up to ₹5,000 a day. The wallet opens a YouPI checkout with a QR and UPI app links. Pay from your own UPI app. UniCart adds the credits only after it verifies YouPI’s signed confirmation and re-reads that payment. The payment page itself cannot mark the top-up successful.</p>
      <p>A payout request of at least ₹10 leaves your spendable balance until staff mark it paid or return it. You can have one payout waiting at a time. Buyer credits and seller earnings share one balance. The ledger is not a bank transfer. UniCart does not read the bank; it accepts the top-up when YouPI’s signed UPI confirmation matches the checkout it opened.</p>
      <h2 className="text-base font-bold">Pay upfront</h2>
      <p>Some stalls accept only campus credits. Tanuj Prints and Potato’s Makerspace are set up that way: the desk prints the file, or hands over the gear, after the credits are taken. The stall card says Pay upfront. Cash at collection is not offered. The credits are taken when you place a priced order. A print job that still needs a quote is charged when you accept the quote.</p>
      <h2 className="text-base font-bold">Cash at the stall</h2>
      <p>Pay on pickup means you pay when you collect. Pay the seller directly means they confirm they received it. UniCart does not hold that cash and does not check it against a bank or UPI. A food stall can keep this option and still accept campus credits.</p>
      <h2 className="text-base font-bold">Refunds</h2>
      <p>Cancel or reject an order, and campus credits already taken return to your balance once. That includes a cancel after the seller has accepted, and a seller cancel before the order is completed. Pay on pickup has nothing to return inside UniCart. When an order is completed, the credits become the seller’s, including a borrow fee once the item is marked back. Cancelling a stall plan stops the next period. The credits for the period you already paid stay with the stall.</p>
      <p>Read the <Link className="text-terracotta underline" to="/terms">terms</Link> for orders, print files, and borrowing.</p>
    </Page>
  )
}

export function HelpPage() {
  return (
    <Page title="Help">
      <h2 className="text-base font-bold">Sign in</h2>
      <p>Enter your email and we send a 6-digit code plus a one-time link. The code lasts 10 minutes. The first time that email is used, add your name so we can open the account. Seeded demo stalls still accept the password on the sign-in page.</p>
      <h2 className="text-base font-bold">Order</h2>
      <p>Search or browse, open a stall, and add what you want. A stall marked Pay upfront takes campus credits when you order and does not take cash at the counter. Other stalls let you choose. Each stall gets its own order. Track it from your account.</p>
      <h2 className="text-base font-bold">Print</h2>
      <p>Open a print listing, upload the file, and choose ink, paper, sides, binding, and copies. The price updates before you add it to the cart.</p>
      <h2 className="text-base font-bold">Borrow</h2>
      <p>Open a lending stall. Pick the day you collect it and the day you bring it back. The price is that listing’s daily or hourly rate, up to the limit the seller set.</p>
      <h2 className="text-base font-bold">Featured listings</h2>
      <p>A seller can put up to three published listings on the home page. That choice is free. It is not a paid advertisement, and it does not renew or expire on its own. Take a listing off the home page from Seller Studio when you want another one there.</p>
      <h2 className="text-base font-bold">Meet on campus</h2>
      <p>Collect at the stall’s pickup spot, or at the campus meetup you both chose. If a stall is pay upfront, the credits are already taken in UniCart. Do not send a second payment on another app for that order. Use Report on a stall, listing, or message that is not what it claims.</p>
      <h2 className="text-base font-bold">Run a stall</h2>
      <p>Open your stall from the header. An admin approves it before students can see it. In ordering rules, leave Pay on pickup on if you take cash at the counter. Turn it off, and leave Campus wallet on, if you will not start until the credits are taken. The stall is then listed as Pay upfront. Write listings yourself, or dictate a sentence that includes the price and the stock, then save. Feature on home puts that listing in the featured row.</p>
      <p>Payments are explained on the <Link className="text-terracotta underline" to="/payments">payments</Link> page.</p>
    </Page>
  )
}
