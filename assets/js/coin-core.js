// THE UNITAS GLOBAL -- Rev 1 Coin-Core live balance tracker.
//
// Wraps a Supabase Realtime subscription on the caller's own `wallets` row
// so the U-COIN balance shown in the portal dashboard updates the instant a
// credit or debit lands -- a Stripe webhook crediting a purchase, or a spend
// from another tab -- instead of only after the current tab's own actions.
(function () {
  'use strict';

  var channel = null;

  function subscribe(client, userId, onChange) {
    unsubscribe();
    if (!client || !userId) return;
    channel = client
      .channel('wallet-' + userId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: 'user_id=eq.' + userId },
        function () { onChange(); }
      )
      .subscribe();
  }

  function unsubscribe() {
    if (channel) {
      channel.unsubscribe();
      channel = null;
    }
  }

  window.UnitasCoinCore = { subscribe: subscribe, unsubscribe: unsubscribe };
})();
