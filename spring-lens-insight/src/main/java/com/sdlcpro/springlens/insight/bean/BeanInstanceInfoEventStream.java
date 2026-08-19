package com.sdlcpro.springlens.insight.bean;

import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.listener.bean.BeanInstanceInfoCollectListener;

/**
 * Defines a reactive/pub-sub contract for publishing collected BeanInstanceInfo models
 * and managing listener subscriptions.
 */
public interface BeanInstanceInfoEventStream {
    /**
     * Broadcasts a collected BeanInstanceInfo entity to active stream listeners.
     *
     * @param beanInstanceInfo the collected bean instance metadata to broadcast
     */
    void publish(BeanInstanceInfo beanInstanceInfo);
    /**
     * Registers a listener to receive BeanInstanceInfo events.
     *
     * @param listener the callback to register for receiving subsequent bean instance events
     */
    void subscribe(BeanInstanceInfoCollectListener listener);
}
