---
goal: have-10-users-of-the-agentic-loop
tags:
  - marketplace
  - data
  - spreadsheets
  - api
  - luca
  - research
status: exploring
---

# Datapimp Marketplace For Parameterized Functions

Datapimp.com is an online marketplace for parameterized functions that return either tabular data or single-cell values.

Consumers should be able to access these functions through multiple interfaces:

- a REST API
- an Excel function
- a Google Sheets Apps Script function
- OpenAI-compatible tool specs for composition into tool calls, MCP servers, and similar agent interfaces

The product vision comes from Jon's direct experience building and operating data pipelines for hedge funds, where large amounts of money are spent each year to make valuable datasets easy to access and consume.

The core idea is to make curated datasets monetizable through a function interface instead of only through bulk data delivery or bespoke integrations.

## Motivation

There is real market value in access to clean, curated, decision-useful data. Today, much of that value is captured through expensive and operationally heavy data vendor relationships.

Datapimp.com would create a marketplace layer where dataset owners can package access as parameterized functions, and consumers can discover, subscribe to, and call those functions from tools they already use.

This could lower the barrier to commercialization for niche datasets, create a more flexible consumption model for users, and open the door to spreadsheet-native and AI-native data products.

## Product Vision

A user can subscribe to a provider of functions through datapimp.com.

Each provider determines pricing or cost structure for the functions they expose. Datapimp.com acts as the marketplace, registry, broker, and middleman that takes a cut of the transaction.

Examples of consumption include:

- `DATAPIMP("us_govt_weather_forecast", "Chicago, IL", "Dec 25, 2026")`
- `POST service.datapimp.com/functions/us_govt/weather_forecast?...`
- using a function's OpenAI-compatible tool definition inside an agent workflow

Consumers should be able to browse all available functions, their parameters, descriptions, and provider information.

## Providers Of Functions

Anyone can become a provider of functions by registering with the datapimp.com service.

A provider is likely someone who has gathered, curated, cleaned, or maintained a dataset and wants to monetize access to it.

Possible provider-side behavior:

- register a data provider with datapimp.com
- expose one or more functions with metadata, parameters, descriptions, and pricing
- receive requests to fulfill through a socket-based or web-based protocol
- return structured responses that datapimp.com can normalize, cache, and deliver to consumers

## Datapimp.com Service Responsibilities

The central service may be responsible for:

- marketplace and online registry hosting
- centralized authentication
- subscription and billing coordination
- job dispatching
- request logging and observability
- throttling and quota enforcement
- response caching
- Redis-based caching for smaller payloads
- S3 or similar object storage for larger payloads

## Consumers Of Functions

Potential consumers include:

- Google Sheets users
- Excel users
- developers calling a REST API
- AI agents consuming tool specs
- teams composing functions into workflows or MCP servers

The user experience should make functions easy to discover and easy to call from the environments where people already work.

## Dataset Commissioning Marketplace

Datapimp.com could also support demand-side requests for new datasets or functions.

Possible behaviors:

- users post requests for datasets or functions along with a budget
- providers quote, bid, or propose delivery terms
- the community votes on desired datasets or functions
- datapimp.com hosts or highlights popular open datasets, such as U.S. government contracts being issued

This would make the marketplace not just a catalog of existing functions, but also a mechanism for surfacing unmet data demand.

## Research Areas

This idea needs technical research before it is ready to become a project.

Important research areas include:

- how Luca framework assistants, tools, auth, and deployment models could support the marketplace architecture
- how Google Sheets Apps Script custom functions and extensions should be implemented, distributed, authenticated, and rate-limited
- how Excel integration should work, whether through Office add-ins, custom functions, or another delivery model
- provider protocol design for request dispatch and response handling
- pricing, metering, and entitlement enforcement models
- caching and payload-delivery architecture for small versus large responses
- marketplace trust and safety concerns, including provider verification and abuse prevention
- how function definitions should map to REST, spreadsheet functions, and OpenAI-compatible tool schemas

## Open Questions

- Should providers execute functions synchronously, asynchronously, or both?
- What is the minimum provider protocol needed for a first version?
- How should authentication work across API, Excel, and Google Sheets clients?
- How should spreadsheet formulas handle errors, auth prompts, quota limits, and large table returns?
- Should datapimp.com host provider code, broker requests to provider infrastructure, or support both models?
- What billing model best fits the marketplace: subscription, usage-based, per-function, or hybrid?
- What should the initial category of seed datasets or functions be?
