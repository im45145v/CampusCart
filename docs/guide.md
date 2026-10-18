# Using UniCart

UniCart is one campus board. Students order from stalls, and students run those stalls. This page is the buyer and seller guide. Payment rules that the software actually enforces are in [architecture.md](architecture.md) and on the site under Payments and Terms.

## Buyer

1. Search or open a category. The home page also shows featured listings, stalls, a food row, a printing row, a lending row, listings added recently, and what has sold most.
2. Open the listing. Food can have extras. A print listing asks for the file, ink, paper, sides, binding, and copies, and the server prices that file. A borrow asks for the collect date and the return date, and the fee is the listing’s daily or hourly rate up to the seller’s cap.
3. Check out one stall at a time. A stall marked pay upfront takes campus credits when the price is known and does not take cash at collection. Other stalls let you choose campus credits or cash when you collect.
4. Collect at the stall’s pickup spot, or at a campus meetup when that stall offers one. Message the stall from the listing if something is still unclear.
5. Cancel while the order is placed or accepted, or while a quote is open. Campus credits already taken come back once. After the order is completed, those credits belong to the seller.

Campus credits are a ledger on this campus. To add funds, pay the desk UPI shown in your wallet and submit the transaction ID. An admin confirms it before you can spend the credits. A payout leaves your balance when you request it. Neither step checks a bank or UPI payment.

## Seller

1. Open a stall from the header. An admin approves it before students can see it.
2. Write the listing, including the price and the stock. A dictated sentence can fill a draft. The draft stays unpublished until you publish it, and a missing price or stock stays missing.
3. In ordering rules, leave pay on pickup on if you take cash at the counter. Turn it off and leave campus wallet on if you will not start until the credits are taken. The stall is then listed as pay upfront.
4. Feature on home puts a published listing in the featured row. A stall can feature three listings. The place is free, it does not expire, and taking one off frees the slot. Featuring does not change the price.

## What this board does not do

These ideas show up on other marketplaces. They are not part of UniCart, and the docs should not describe them as if they were.

- Paid featured placements, promotion fees, or a featured listing that expires and must be bought again.
- A commission on the order. Completing a wallet-paid order credits the seller the amount charged.
- Buying or selling social accounts, email accounts, or login details, and any automatic delivery of those credentials.
- Crypto, or automated UPI or bank verification. The desk UPI is only an address to pay. Cash at the stall is confirmed by the seller. UniCart does not check either one.
- A second campus, a waitlist for other institutes, or a rule that only a `.ac.in` address can register. Accounts here use the email the student registers.
- A wanted-request board. Ask the stall from the listing, or open your own stall.
- A deposit held by UniCart for a borrow. The fee is the rate on the listing. Any cash deposit is between the two students.
