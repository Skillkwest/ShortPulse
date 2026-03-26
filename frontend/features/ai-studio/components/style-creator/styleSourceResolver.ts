/**
 * Backward-compatible Styles wrapper around the shared internal reference source contract.
 * Keeps the existing Styles imports stable while ownership moves into a shared module.
 */
export {
  resolveInternalReferenceSource as resolveStyleInternalDropSource,
  type ReferenceSourceKind,
  type ReferenceSourceResolutionReason,
  type ResolveInternalReferenceDrop as ResolveInternalStyleDrop,
  type ResolvedInternalReferenceSource as ResolvedInternalStyleSource,
} from "../../logic/referenceSource/internalReferenceSource";
