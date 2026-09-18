# Builder App Deployment Explorer

Interactive React visualization of the Embr Builder App deployment lifecycle. It covers manual
first deploy, deploy-latest replacement, and retained-version redeploy.

The sequence distinguishes AppVersion creation from the durable deployment operation, ADC native
readiness from direct HTTPS health, atomic YARP activation from public-route verification, and
deployment success from independently retried post-deployment cleanup.

## Local development

```powershell
npm install
npm run dev
```

## Verification

```powershell
npm test
npm run build
npm run lint
```

## Builder App deployment

The repository-root `builder.yaml` declares this directory as a static Vite component. Builder
detects the framework from `package.json`, builds `dist/`, publishes the immutable static output to
Blob Storage, and activates it through the Builder App route.
