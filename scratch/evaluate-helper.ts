// Helper mirroring migration 0048 evaluate_order_superseded logic
export function evaluateOrderSupersededLocal(v_old: any, v_new: any) {
  if (!v_old || !v_new || v_old.id === v_new.id) {
    return { superseded: false, reason: 'INVALID_ORDER_PAIR' };
  }

  // 1. Phải cùng user_id
  if (v_old.user_id !== v_new.user_id) {
    return { superseded: false, reason: 'DIFFERENT_USER' };
  }

  // 2. Đơn mới không được cancelled/refunded
  if (['cancelled', 'refunded'].includes(v_new.status)) {
    return { superseded: false, reason: 'NEW_ORDER_CANCELLED_OR_REFUNDED' };
  }

  // 3. Đơn mới phải tạo sau đơn cũ
  const oldCreated = new Date(v_old.created_at).getTime();
  const newCreated = new Date(v_new.created_at).getTime();
  if (newCreated <= oldCreated) {
    return { superseded: false, reason: 'NEW_ORDER_NOT_NEWER' };
  }

  // 4. Case A: Explicit Renewal
  if (v_new.renewed_from_order_id === v_old.id) {
    return {
      superseded: true,
      reason: 'EXPLICIT_RENEWAL',
      confidence: 'HIGH',
      old_order_id: v_old.id,
      new_order_id: v_new.id,
    };
  }

  // 5. Case B: Auto-Detected
  // Same product
  if (v_old.product_name?.trim().toLowerCase() !== v_new.product_name?.trim().toLowerCase()) {
    return { superseded: false, reason: 'DIFFERENT_PRODUCT' };
  }

  const v_old_target = (v_old.target_account || '').trim().toLowerCase();
  const v_new_target = (v_new.target_account || '').trim().toLowerCase();

  // Target Account checks
  if (v_old_target !== '' && v_new_target !== '' && v_old_target !== v_new_target) {
    return {
      superseded: false,
      reason: 'DIFFERENT_TARGET_ACCOUNT',
      old_target: v_old_target,
      new_target: v_new_target,
    };
  }

  if ((v_old_target !== '' && v_new_target === '') || (v_old_target === '' && v_new_target !== '')) {
    return {
      superseded: false,
      reason: 'INSUFFICIENT_EVIDENCE_TARGET_ACCOUNT_MISMATCH',
      old_target: v_old_target,
      new_target: v_new_target,
    };
  }

  const v_old_exp = new Date(v_old.expires_at).getTime();
  const v_new_exp = new Date(v_new.expires_at).getTime();

  // Multi-quantity: Mua nhiều slot/account cùng lúc
  if ((v_new.quantity || 1) > 1 && (v_old.quantity || 1) === 1 && (v_new_target === '' || v_old_target !== v_new_target)) {
    return { superseded: false, reason: 'MULTI_QUANTITY_PURCHASE' };
  }

  // Both target null: slot purchase ambiguity
  if (v_old_target === '' && v_new_target === '') {
    if (newCreated < v_old_exp - 3 * 86400000) {
      return {
        superseded: false,
        reason: 'INSUFFICIENT_EVIDENCE_UNIDENTIFIED_SLOT',
        details: 'Cả 2 đơn không có target_account và đơn mới được tạo quá sớm so với ngày hết hạn của đơn cũ.',
      };
    }
  }

  // Expiry extension: Đơn mới phải có hạn xa hơn đơn cũ
  if (v_new_exp <= v_old_exp) {
    return { superseded: false, reason: 'EXPIRY_NOT_EXTENDED' };
  }

  // Time window: [-15d, +30d]
  if (newCreated < v_old_exp - 15 * 86400000) {
    return { superseded: false, reason: 'ORDER_CREATED_TOO_EARLY_FOR_RENEWAL' };
  }
  if (newCreated > v_old_exp + 30 * 86400000) {
    return { superseded: false, reason: 'ORDER_CREATED_TOO_LATE_FOR_RENEWAL' };
  }

  return {
    superseded: true,
    reason: 'AUTO_DETECTED_RENEWAL',
    confidence: v_old_target !== '' && v_old_target === v_new_target ? 'HIGH' : 'MEDIUM',
    old_order_id: v_old.id,
    new_order_id: v_new.id,
  };
}
