import type { APIRoute } from 'astro';
import { verifyWebhookSignature, getTierFromPriceId } from '../../../lib/stripe';
import { supabase } from '../../../lib/supabase';
import type Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify webhook signature
    const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const event = verifyWebhookSignature(body, signature, webhookSecret);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const userId = session.client_reference_id || session.metadata?.user_id;
    if (!userId) {
      console.error('No user ID in checkout session');
      return;
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    // Get subscription details to determine tier
    const { stripe } = await import('../../../lib/stripe');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId || '');

    // Update user's subscription in database
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        tier,
        status: 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });

    if (subError) {
      console.error('Error updating subscription:', subError);
      return;
    }

    // Update user's profile tier
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ subscription_tier: tier })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile tier:', profileError);
    }

    console.log(`Subscription created for user ${userId}: ${tier}`);
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      console.error('No user ID in subscription metadata');
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId || '');
    const status = subscription.status;

    // Update subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({
        tier,
        status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (subError) {
      console.error('Error updating subscription:', subError);
    }

    // Update profile tier if subscription is active
    if (status === 'active') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile tier:', profileError);
      }
    }

    console.log(`Subscription updated for user ${userId}: ${tier} (${status})`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      console.error('No user ID in subscription metadata');
      return;
    }

    // Update subscription status
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        tier: 'free',
      })
      .eq('user_id', userId);

    if (subError) {
      console.error('Error updating subscription:', subError);
    }

    // Downgrade user to free tier
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ subscription_tier: 'free' })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile tier:', profileError);
    }

    console.log(`Subscription canceled for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    // Payment successful - subscription is already active
    console.log(`Payment succeeded for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    // Get subscription to find user
    const { stripe } = await import('../../../lib/stripe');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.user_id;

    if (!userId) {
      console.error('No user ID in subscription metadata');
      return;
    }

    // Update subscription status to past_due
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating subscription status:', error);
    }

    console.log(`Payment failed for user ${userId}, subscription ${subscriptionId}`);
    // Here you could send an email notification to the user
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}
