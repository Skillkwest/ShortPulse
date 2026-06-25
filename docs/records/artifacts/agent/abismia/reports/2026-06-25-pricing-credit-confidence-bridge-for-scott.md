# Pricing Credit Confidence Bridge

Status: proposal for Scott review  
Date: 2026-06-25  
Owner for approval: Scott / user

## The Simple Version

ShortPulse pricing already shows the plans clearly.

What is missing is a plain-English answer to:

> What can I actually make with these credits?

Right now, a customer sees numbers like **350**, **1,200**, or **3,200** credits. Those numbers are technically correct, but they still feel abstract.

The fix is to add a small explanation layer to the pricing page that translates credits into real creative output.

## The Problem

Customers are not really buying "credits."

They are trying to decide:

- Can I make enough images?
- Can I test video without burning through my plan?
- Is this plan too small?
- Am I about to waste money?
- Will I understand what I am spending before I click Generate?

If we do not answer those questions, credits feel like an internal currency instead of customer confidence.

## What We Would Build

### 1. Add A Short Credit Explanation

Near the top of the pricing page, add a simple note:

> Credits are used when you generate. ShortPulse shows the credit cost before you run each generation. Images usually cost less than video, and video cost changes based on model, quality, and duration.

This tells the customer three important things:

- credits are tied to actual generation
- the app shows the cost before spending
- different creative actions cost different amounts

### 2. Add A "What This Plan Is Good For" Line

Each plan should get one plain-language outcome line.

Example:

| Plan     | Plain-English Meaning                                  |
| -------- | ------------------------------------------------------ |
| Starter  | Good for image exploration and editing experiments.    |
| Media    | Good for image work plus short video or audio testing. |
| Studio   | Good for consistent mixed-media production.            |
| Business | Good for frequent production and heavier workloads.    |

This helps customers choose based on their actual workflow, not just the biggest number.

### 3. Add A Small Credit Guide

Add a compact guide that explains the rough shape of credit usage.

Example:

| Creative Action           | Credit Feeling      |
| ------------------------- | ------------------- |
| Simple image drafts       | Low credit use      |
| Premium image generations | Moderate credit use |
| Audio / voice outputs     | Moderate credit use |
| Short video generations   | Higher credit use   |

This should stay simple. The goal is confidence, not a spreadsheet.

## What We Should Avoid

Do not make exact promises like:

> This plan gives you exactly 150 videos.

That would be risky because generation cost can change by:

- model
- resolution
- duration
- audio settings
- future pricing updates

Instead, use careful language:

- "roughly"
- "good for"
- "typical"
- "varies by model and settings"
- "the app shows the credit cost before you generate"

## Best First Version

Build the smallest useful version first:

1. Add a short credit explanation near the pricing hero.
2. Add one outcome line per plan.
3. Add a small credit guide below or beside the plan cards.
4. Keep all language simple and conservative.

This gives customers more confidence without creating a complicated pricing calculator.

## Later Upgrade

If the first version feels useful, we can later build an interactive estimator:

> "I mostly make images / videos / audio / mixed media."

Then the page could suggest which plan fits that workflow.

That is a second step. The first step should be simpler.

## Approval Question

Do we want the pricing page to explain credits in terms of real creative output?

Recommended answer: **yes**.

Reason: this should reduce hesitation, make plans easier to compare, and help customers feel safer before paying.
