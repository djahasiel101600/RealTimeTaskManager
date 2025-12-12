from typing import Callable
from django.utils.deprecation import MiddlewareMixin


class CookieToAuthHeaderMiddleware(MiddlewareMixin):
    """Middleware that reads the `access` HttpOnly cookie and, if present
    and no Authorization header is set, sets `HTTP_AUTHORIZATION` so that
    DRF Simple JWT `JWTAuthentication` will read it.

    Note: cookies are HttpOnly so JS cannot read or modify them; the cookie
    is set by the login/refresh endpoints on the server-side.
    """
    def process_request(self, request):
        # If client already sent Authorization header, don't override
        if request.META.get('HTTP_AUTHORIZATION'):
            return None

        access = request.COOKIES.get('access')
        if access:
            # Set the Authorization header in request.META for Django REST
            # framework to process as a Bearer token.
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {access}'
        return None
