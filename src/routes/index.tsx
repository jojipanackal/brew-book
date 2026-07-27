import { createFileRoute } from "@tanstack/react-router";

import BrewBookApp from "#/brewbook-app";

export const Route = createFileRoute("/")({ component: BrewBookApp });
