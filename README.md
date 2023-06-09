# StatefulReconnection

This is an **experimental** alternative UX for reconnection in Blazor Server. Once you add `<StatefulReconnection />` to your `App.razor` component, the behavior will change as follows:

 * Reconnection is attempted more eagerly (defaults to every 1 second instead of defaulting to every 20 seconds)
 * If the server is reached but the user's circuit is gone, it auto-reloads the page so the user can continue
   * This differs from Blazor Server's traditional behavior, which is to prompt the user to reload manually
 * Attempts to preserve form state across new circuits
   * When connection is lost, client-side JS code automatically captures the state of any form fields in the page.
   * If the page is reloaded (e.g., automatically because the server no longer has the user's circuit, or if the user reloads manually), then client-side JS code will attempt to restore the state of the form fields in the new page
   * It also preserves element focus across these circuit restarts

The result is:

 * If the user is on a read-only page, then in many cases it will auto-reload and continue without user interaction
 * If the user has a form on the page, then in many cases it will preserve their unsaved edits and focus state

However, it *only* preserves the state of form elements. It cannot preserve the state of any .NET objects that are being modified on the server, as that would involve the developer implementing logic manually to use a persistent store for those objects (for example using [the pattern demonstrated here](https://github.com/SteveSandersonMS/CircuitPersisterExample)).

### Installation

Reference the package `StatefulReconnection` using VS or the command line, e.g.:

    dotnet add package StatefulReconnection

In your `App.razor`, add `<StatefulReconnection />` before or after your `<Router />`. Example:

```razor
<StatefulReconnection />

<Router AppAssembly="@typeof(App).Assembly">
    ... leave contents unchanged ...
</Router>
```

### Feedback

The purpose of this package is to explore whether this kind of client-side form field preservation would be useful to provide a better user experience around reconnection with Blazor Server.

It is not yet expected to work perfectly in all cases, and it is not really customizable or extensible within the current implementation.

If this scenario is important to you, please try this out and let us know if it actually helps.
