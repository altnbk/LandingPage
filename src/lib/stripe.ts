import Stripe from 'stripe';

// Initialize Stripe
export const stripe = new Stripe(
  import.meta.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '',
  {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  }
);

// Product IDs (you'll create these in Stripe Dashboard)
export const STRIPE_PRODUCTS = {
  pro: {
    priceId: import.meta.env.PUBLIC_STRIPE_PRO_PRICE_ID || process.env.PUBLIC_STRIPE_PRO_PRICE_ID,
    name: 'Pro',
    amount: 2900, // $29.00 in cents
  },
  business: {
    priceId: import.meta.env.PUBLIC_STRIPE_BUSINESS_PRICE_ID || process.env.PUBLIC_STRIPE_BUSINESS_PRICE_ID,
    name: 'Business',
    amount: 7900, // $79.00 in cents
  },
};

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
        },
      },
    });

    return session;
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
}

/**
 * Create a customer portal session for subscription management
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    throw new Error(`Failed to create portal session: ${error.message}`);
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error: any) {
    console.error('Error retrieving subscription:', error);
    throw new Error(`Failed to retrieve subscription: ${error.message}`);
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): 'pro' | 'business' | 'free' {
  if (priceId === STRIPE_PRODUCTS.pro.priceId) {
    return 'pro';
  } else if (priceId === STRIPE_PRODUCTS.business.priceId) {
    return 'business';
  }
  return 'free';
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error: any) {
    console.error('Error verifying webhook signature:', error);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}
